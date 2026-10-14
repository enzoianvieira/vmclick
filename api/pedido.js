/**
 * /api/pedido
 *
 *   GET               -> formas de pagamento ativas e regras (desconto Pix,
 *                        parcelas), para o checkout montar o passo 3
 *   GET  ?id=...      -> situação do pedido, para a página do pedido
 *   POST { cliente, entrega, itens, frete, forma, parcelas, totalVisto }
 *                     -> cria o pedido e a cobrança no Asaas
 *
 * O QUE O NAVEGADOR NÃO DECIDE
 * Preço dos produtos, preço do frete e desconto são recalculados aqui, a
 * partir do catálogo e de uma cotação nova. Do navegador vêm só SKU,
 * quantidade e o id da opção de entrega. Sem isso daria para editar o preço
 * no DevTools e comprar por R$ 1.
 *
 * `totalVisto` é o total que a tela mostrou. Não define nada: se o valor
 * recalculado for outro (preço mudou, frete mudou), o pedido é recusado com
 * o total novo, para ninguém ser cobrado de um valor que não viu.
 */

const asaas = require('./_asaas.js');
const pedidos = require('./_pedido.js');
const armazem = require('./_armazem.js');
const config = require('./_config.js');
const { opcoesDeEntrega, catalogo, OPCAO_RETIRADA, ErroFrete } = require('./_frete.js');

const { ErroPagamento } = asaas;

/* ------------------------------------------------------------- regras ---- */

const FORMAS = (process.env.PAGAMENTO_FORMAS || 'pix,boleto,cartao')
  .split(',').map((f) => f.trim()).filter((f) => ['pix', 'boleto', 'cartao'].includes(f));

const DESCONTO_PIX = Number(process.env.PIX_DESCONTO || 5);
const MAX_PARCELAS = Math.min(12, Number(process.env.CARTAO_MAX_PARCELAS || 6));
/* Mesma régua da vitrine: R$ 150 em 6x, R$ 99 em 3x. */
const PARCELA_MINIMA = Number(process.env.CARTAO_PARCELA_MINIMA || 25);
const BOLETO_DIAS = Number(process.env.BOLETO_DIAS || 3);

/* O Asaas não emite cobrança abaixo de R$ 5. */
const VALOR_MINIMO = 5;

/* Cada pedido cria cadastro e cobrança no Asaas. Teto por IP para um script
   não encher a conta de lixo. */
const LIMITE_POR_HORA = 10;

const MAX_ITENS = 60;

/* Cartão recusado conta à parte e com teto menor. Checkout que aceita
   cartão digitado vira alvo de "teste de cartão": fraudador validando
   cartões roubados aos montes. */
const RECUSAS_POR_HORA = 5;

/* ---------------------------------------------------------- utilitários --- */

const r2 = (n) => Math.round(n * 100) / 100;
const digitos = (v) => String(v || '').replace(/\D/g, '');
const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

function ipDe(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

/** Data em Brasília, AAAA-MM-DD, `dias` à frente. É o formato do Asaas. */
function dataBrasilia(dias) {
  const d = new Date(Date.now() + (dias || 0) * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
  }
  return true;
}

function cnpjValido(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  const dv = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * pesos[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

class ErroPedido extends Error {
  constructor(status, mensagem, extra) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

/* ------------------------------------------------------------ validação --- */

function validarCliente(c) {
  c = c || {};
  const cliente = {
    nome: texto(c.nome, 100),
    doc: digitos(c.doc),
    email: texto(c.email, 120).toLowerCase(),
    tel: digitos(c.tel),
    pj: Boolean(c.pj),
  };

  if (cliente.nome.split(/\s+/).length < 2) throw new ErroPedido(400, 'Informe nome e sobrenome.');
  if (!(cpfValido(cliente.doc) || cnpjValido(cliente.doc))) throw new ErroPedido(400, 'CPF ou CNPJ inválido.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) throw new ErroPedido(400, 'E-mail inválido.');
  if (cliente.tel.length < 10 || cliente.tel.length > 11) throw new ErroPedido(400, 'Telefone inválido. Use DDD + número.');

  return cliente;
}

function validarEndereco(e, exigeEndereco) {
  e = e || {};
  const end = {
    cep: digitos(e.cep),
    rua: texto(e.rua, 120),
    numero: texto(e.numero, 20),
    compl: texto(e.compl, 80),
    bairro: texto(e.bairro, 80),
    cidade: texto(e.cidade, 80),
    uf: texto(e.uf, 2).toUpperCase(),
  };

  if (end.cep.length !== 8) throw new ErroPedido(400, 'CEP inválido.');
  if (exigeEndereco) {
    if (!end.rua || !end.numero || !end.bairro || !end.cidade) {
      throw new ErroPedido(400, 'Preencha o endereço de entrega completo.');
    }
    if (!/^[A-Z]{2}$/.test(end.uf)) throw new ErroPedido(400, 'Informe a UF com duas letras.');
  }
  return end;
}

function normalizarItens(bruto) {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((i) => ({ sku: String((i && i.sku) || '').trim(), qtd: Math.floor(Number(i && i.qtd) || 0) }))
    .filter((i) => i.sku && i.qtd > 0 && i.qtd <= 999)
    .slice(0, MAX_ITENS);
}

/* Luhn: o dígito verificador de todo número de cartão. Pega erro de
   digitação antes de gastar uma tentativa na operadora. */
function luhn(numero) {
  let soma = 0;
  for (let i = 0; i < numero.length; i++) {
    let d = Number(numero[numero.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    soma += d;
  }
  return soma % 10 === 0;
}

/**
 * Valida o cartão e devolve no formato do Asaas. Fica só na memória desta
 * chamada: não entra no pedido, no KV nem em log.
 */
function validarCartao(c) {
  c = c || {};
  const nome = texto(c.nome, 60);
  const numero = digitos(c.numero);
  const mes = Math.floor(Number(c.mes));
  let ano = digitos(c.ano);
  if (ano.length === 2) ano = '20' + ano;
  const cvv = digitos(c.cvv);

  if (nome.length < 3) throw new ErroPedido(400, 'Informe o nome impresso no cartão.');
  if (numero.length < 13 || numero.length > 19 || !luhn(numero)) throw new ErroPedido(400, 'Número do cartão inválido.');
  if (!(mes >= 1 && mes <= 12) || ano.length !== 4) throw new ErroPedido(400, 'Validade do cartão inválida.');

  const agora = new Date();
  const anoAtual = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth() + 1;
  if (Number(ano) < anoAtual || (Number(ano) === anoAtual && mes < mesAtual) || Number(ano) > anoAtual + 20) {
    throw new ErroPedido(400, 'Cartão vencido ou validade inválida.');
  }
  if (cvv.length < 3 || cvv.length > 4) throw new ErroPedido(400, 'Código de segurança (CVV) inválido.');

  return { nome, numero, mes: String(mes).padStart(2, '0'), ano, cvv };
}

/** Preço e nome saem do catálogo do servidor, nunca do navegador. */
function precificar(itens) {
  const cat = catalogo();
  return itens.map((i) => {
    const p = cat.get(i.sku);
    if (!p) throw new ErroPedido(409, 'Um dos produtos saiu do catálogo. Atualize o carrinho.');
    if (p.estoque != null && i.qtd > Number(p.estoque)) {
      throw new ErroPedido(409, `Estoque insuficiente de ${p.nome}. Disponível: ${p.estoque}.`);
    }
    const preco = Number(p.preco) || 0;
    return { sku: i.sku, nome: p.nome, qtd: i.qtd, preco, sub: r2(preco * i.qtd) };
  });
}

/**
 * Reconta o frete e devolve a opção escolhida com o preço do servidor.
 *
 * "Combinar com a loja" só existe quando a cotação está fora do ar. Se ela
 * responde, a opção é recusada: senão bastaria mandar "combinar" para fechar
 * qualquer pedido com frete zero.
 */
async function resolverFrete(freteId, endereco, itens, subtotal) {
  /* Retirada não depende da cotação: funciona com o Melhor Envio fora. */
  if (freteId === 'retirada') return { opcao: { ...OPCAO_RETIRADA }, aCombinar: false };

  if (freteId === 'combinar') {
    try {
      await opcoesDeEntrega(endereco.cep, itens, subtotal);
    } catch (e) {
      if (e instanceof ErroFrete && e.status >= 500) {
        return {
          opcao: { id: 'combinar', tipo: 'combinar', servico: 'Combinar entrega com a loja', preco: 0, prazo: null },
          aCombinar: true,
        };
      }
      throw e;
    }
    throw new ErroPedido(409, 'O frete já pode ser calculado. Volte ao passo de entrega e escolha uma opção.');
  }

  const r = await opcoesDeEntrega(endereco.cep, itens, subtotal);
  const opcao = r.opcoes.find((o) => o.id === freteId);
  if (!opcao) throw new ErroPedido(409, 'Essa forma de entrega não está mais disponível. Recalcule o frete.');
  return { opcao, aCombinar: false };
}

/* ---------------------------------------------------------------- criar --- */

async function criar(req, res) {
  if (!(await config.asaas()).chave) throw new ErroPedido(503, 'Pagamento online ainda não configurado.');
  if (!armazem.disponivel()) {
    throw new ErroPedido(503, 'Pagamento indisponível: o servidor não tem onde guardar pedidos (configure o KV).');
  }

  const n = await armazem.incrementar(`vmclick:limite:pedido:${ipDe(req)}`, 3600);
  if (n > LIMITE_POR_HORA) throw new ErroPedido(429, 'Muitas tentativas. Tente de novo em uma hora ou fale com a loja.');

  const corpo = lerCorpo(req);

  const forma = String(corpo.forma || '');
  if (!FORMAS.includes(forma)) throw new ErroPedido(400, 'Forma de pagamento indisponível.');

  const cliente = validarCliente(corpo.cliente);
  const itensPedidos = normalizarItens(corpo.itens);
  if (!itensPedidos.length) throw new ErroPedido(400, 'Carrinho vazio.');

  const itens = precificar(itensPedidos);
  const subtotal = r2(itens.reduce((s, i) => s + i.sub, 0));

  const freteId = String(corpo.frete || '');
  const retirada = freteId === 'retirada';
  const endereco = validarEndereco(corpo.entrega, !retirada);
  const { opcao, aCombinar } = await resolverFrete(freteId, endereco, itensPedidos, subtotal);
  const frete = r2(opcao.preco);

  const bruto = r2(subtotal + frete);
  const desconto = forma === 'pix' ? r2(bruto * DESCONTO_PIX / 100) : 0;
  const total = r2(bruto - desconto);

  if (total < VALOR_MINIMO) throw new ErroPedido(400, `O valor mínimo para pagamento online é R$ ${VALOR_MINIMO},00.`);

  const cartao = forma === 'cartao' ? validarCartao(corpo.cartao) : null;
  if (cartao) {
    const recusas = Number(await armazem.ler(`vmclick:limite:recusa:${ipDe(req)}`)) || 0;
    if (recusas >= RECUSAS_POR_HORA) {
      throw new ErroPedido(429, 'Muitas tentativas de cartão recusadas. Tente de novo mais tarde ou use Pix.');
    }
  }

  let parcelas = 1;
  if (forma === 'cartao') {
    parcelas = Math.max(1, Math.floor(Number(corpo.parcelas) || 1));
    const maximo = Math.max(1, Math.min(MAX_PARCELAS, Math.floor(total / PARCELA_MINIMA)));
    if (parcelas > maximo) throw new ErroPedido(400, `Este valor pode ser parcelado em até ${maximo}x.`);
  }

  if (corpo.totalVisto != null && Math.abs(Number(corpo.totalVisto) - total) > 0.05) {
    throw new ErroPedido(409, 'Os valores foram atualizados. Confira o novo total antes de pagar.', { total });
  }

  /* O pedido é gravado ANTES da cobrança existir. Ao contrário, uma falha na
     gravação deixaria uma cobrança no Asaas sem pedido, e o aviso de
     pagamento dela chegaria sem ter onde cair. */
  const pedido = {
    id: pedidos.novoId(),
    numero: await pedidos.novoNumero(),
    criadoEm: new Date().toISOString(),
    status: 'aguardando',
    forma,
    parcelas,
    cliente,
    entrega: { ...endereco, opcao, aCombinar },
    itens,
    subtotal,
    frete,
    desconto,
    total,
    historico: [{ em: new Date().toISOString(), status: 'aguardando', origem: 'checkout' }],
  };
  await pedidos.gravar(pedido);
  await pedidos.registrar(pedido);

  let cobranca;
  try {
    const idCliente = await asaas.garantirCliente({ ...cliente, cep: endereco.cep, numero: endereco.numero, compl: endereco.compl });

    const dados = {
      cliente: idCliente,
      forma,
      valor: total,
      parcelas,
      vencimento: dataBrasilia(forma === 'boleto' ? BOLETO_DIAS : forma === 'pix' ? 1 : 0),
      descricao: `Pedido ${pedido.numero} - VM Click`,
      referencia: pedido.id,
    };
    if (cartao) {
      dados.cartao = cartao;
      dados.titular = { ...cliente, cep: endereco.cep, numero: endereco.numero };
      dados.ip = ipDe(req);
    }

    try {
      cobranca = await asaas.criarCobranca(dados);
    } catch (e) {
      /* Tempo esgotado ou rede: a cobrança pode ter sido criada mesmo assim.
         Confere pela referência antes de devolver erro - senão o cliente
         tenta de novo e paga duas vezes. */
      if (e instanceof ErroPagamento) throw e;
      cobranca = await asaas.cobrancaPorReferencia(pedido.id).catch(() => null);
      if (!cobranca) throw new ErroPedido(504, 'O pagamento não respondeu a tempo. Nada foi cobrado; tente de novo.');
    }

    pedido.asaas = {
      cliente: idCliente,
      cobranca: cobranca.id,
      parcelamento: cobranca.parcelamento,
      boletoUrl: cobranca.boletoUrl,
    };
    await pedidos.vincularCobranca(pedido, cobranca);

    /* O QR é o pagamento: sem ele o Pix não acontece dentro do site. Tenta
       duas vezes; se não vier, cancela a cobrança e pede outra forma, em vez
       de deixar o cliente com um pedido que não tem como pagar. */
    if (forma === 'pix') {
      pedido.pix = await asaas.pix(cobranca.id).catch(() => null);
      if (!pedido.pix) {
        await new Promise((r) => setTimeout(r, 800));
        pedido.pix = await asaas.pix(cobranca.id).catch((e) => {
          console.error('[pedido] QR Pix indisponível:', e.message);
          return null;
        });
      }
      if (!pedido.pix) {
        await asaas.cancelarCobranca(cobranca.id);
        throw new ErroPedido(503, 'O Pix está indisponível agora. Escolha outra forma de pagamento ou tente em instantes.');
      }
    }
    if (forma === 'boleto') {
      pedido.boleto = { linha: await asaas.linhaDigitavel(cobranca.id).catch(() => null) };
    }

    await pedidos.gravar(pedido);
  } catch (e) {
    const recusado = e instanceof ErroPagamento && e.status === 402;
    if (recusado) await armazem.incrementar(`vmclick:limite:recusa:${ipDe(req)}`, 3600).catch(() => {});
    await pedidos.mudarStatus(pedido.id, recusado ? 'recusado' : 'falhou', recusado ? 'cartão recusado' : e.message).catch(() => {});
    throw e;
  }

  /* Cartão aprovado já volta pago na mesma chamada. */
  let status = pedido.status;
  if (cobranca.pago) {
    const pago = await pedidos.mudarStatus(pedido.id, 'pago', 'checkout');
    if (pago) status = pago.status;
  }

  return res.status(201).json({ id: pedido.id, numero: pedido.numero, forma, total, status });
}

/* -------------------------------------------------------------- consultar --- */

/* Sem webhook (na máquina de desenvolvimento ele não chega) ou com ele
   atrasado, a página do pedido ficaria parada em "aguardando". Então a
   consulta confere no Asaas de vez em quando - não a cada chamada, porque a
   página pergunta a cada poucos segundos. */
const INTERVALO_CONFERENCIA_MS = 20_000;
const ultimaConferencia = new Map();

async function consultar(req, res, id) {
  let pedido = await pedidos.ler(id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

  const agora = Date.now();
  const cobranca = pedido.asaas && pedido.asaas.cobranca;
  if (pedido.status === 'aguardando' && cobranca && agora - (ultimaConferencia.get(id) || 0) > INTERVALO_CONFERENCIA_MS) {
    ultimaConferencia.set(id, agora);
    try {
      const c = await asaas.consultarCobranca(cobranca);
      if (c.pago) pedido = (await pedidos.mudarStatus(id, 'pago', 'consulta')) || pedido;
    } catch (e) { /* segue com o que está guardado */ }
  }

  return res.status(200).json(pedidos.visaoPublica(pedido));
}

/* ------------------------------------------------------------- handler ---- */

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const id = req.query && req.query.id
        ? String(req.query.id)
        : new URL(req.url, 'http://x').searchParams.get('id');

      if (id) return await consultar(req, res, id);

      return res.status(200).json({
        formas: FORMAS,
        descontoPix: DESCONTO_PIX,
        maxParcelas: MAX_PARCELAS,
        parcelaMinima: PARCELA_MINIMA,
        boletoDias: BOLETO_DIAS,
        ativo: Boolean((await config.asaas()).chave) && armazem.disponivel(),
      });
    }

    if (req.method === 'POST') return await criar(req, res);

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ erro: 'Use GET ou POST' });
  } catch (e) {
    if (e instanceof ErroPedido) return res.status(e.status).json({ erro: e.message, ...(e.extra || {}) });
    if (e instanceof ErroPagamento || e instanceof ErroFrete) return res.status(e.status).json({ erro: e.message });
    console.error('[pedido] falha inesperada:', e);
    return res.status(500).json({ erro: 'Não foi possível concluir agora. Tente de novo em instantes.' });
  }
};
