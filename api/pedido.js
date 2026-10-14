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
const { opcoesDeEntrega, catalogo, ErroFrete } = require('./_frete.js');

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

  try {
    const idCliente = await asaas.garantirCliente({ ...cliente, cep: endereco.cep, numero: endereco.numero, compl: endereco.compl });

    const site = (process.env.SITE_URL || '').replace(/\/$/, '');
    const cobranca = await asaas.criarCobranca({
      cliente: idCliente,
      forma,
      valor: total,
      parcelas,
      vencimento: dataBrasilia(forma === 'boleto' ? BOLETO_DIAS : forma === 'pix' ? 1 : 0),
      descricao: `Pedido ${pedido.numero} - VM Click`,
      referencia: pedido.id,
      retorno: forma === 'cartao' && site ? `${site}/pedido.html?id=${pedido.id}` : null,
    });

    pedido.asaas = {
      cliente: idCliente,
      cobranca: cobranca.id,
      parcelamento: cobranca.parcelamento,
      faturaUrl: cobranca.faturaUrl,
      boletoUrl: cobranca.boletoUrl,
    };
    await pedidos.vincularCobranca(pedido, cobranca);

    /* QR e linha digitável vão junto do pedido: a página do pedido consulta
       a cada poucos segundos e não deve ir ao Asaas toda vez. Falhar aqui não
       derruba o pedido - a fatura (faturaUrl) também mostra os dois. */
    if (forma === 'pix') {
      try { pedido.pix = await asaas.pix(cobranca.id); } catch (e) { pedido.pix = null; }
    }
    if (forma === 'boleto') {
      try { pedido.boleto = { linha: await asaas.linhaDigitavel(cobranca.id) }; } catch (e) { pedido.boleto = null; }
    }

    await pedidos.gravar(pedido);
  } catch (e) {
    await pedidos.mudarStatus(pedido.id, 'falhou', e.message).catch(() => {});
    throw e;
  }

  return res.status(201).json({
    id: pedido.id,
    numero: pedido.numero,
    forma,
    total,
    faturaUrl: pedido.asaas.faturaUrl,
  });
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
