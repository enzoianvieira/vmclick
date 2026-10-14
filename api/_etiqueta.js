/**
 * VM Click - etiqueta de envio pelo Melhor Envio, a partir do painel
 *
 * Fluxo (botão "Gerar etiqueta" no pedido):
 *   1. chave da NF-e: pedido no Olist -> idNotaFiscal -> nota -> chaveAcesso
 *   2. carrinho do Melhor Envio com o serviço que o cliente escolheu
 *   3. compra com o saldo da conta
 *   4. geração da etiqueta
 *   5. link para imprimir e código de rastreio
 *
 * Cada passo concluído fica anotado em `pedido.etiqueta`. Se algo para no
 * meio (sem saldo, nota ainda não emitida), o próximo clique continua de
 * onde parou - nunca compra duas vezes a mesma etiqueta.
 *
 * Envio comercial de empresa exige a chave da NF-e. Em sandbox, sem nota,
 * a etiqueta sai como não comercial (declaração de conteúdo) só para teste.
 */

const { chamarME, montarPacote, ErroFrete } = require('./_frete.js');
const { olistGet } = require('./_olist.js');
const config = require('./_config.js');
const pedidos = require('./_pedido.js');

/* serviços da Jadlog no Melhor Envio (agência opcional, se configurada) */
const SERVICOS_JADLOG = [3, 4, 27];

class ErroEtiqueta extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const so = (v) => String(v || '').replace(/\D/g, '');

/** Chave da NF-e autorizada do pedido no Olist, ou null se ainda não há. */
async function chaveDaNota(pedido) {
  if (!pedido.olist || !pedido.olist.id) {
    throw new ErroEtiqueta(409, 'Este pedido ainda não está no Olist. Use "Enviar ao Olist" e emita a nota lá.');
  }
  const p = await olistGet(`/pedidos/${pedido.olist.id}`);
  if (!p || !p.idNotaFiscal) return null;
  const nota = await olistGet(`/notas/${p.idNotaFiscal}`);
  const chave = so(nota && nota.chaveAcesso);
  return chave.length === 44 ? chave : null;
}

function serviceId(pedido) {
  const op = pedido.entrega && pedido.entrega.opcao;
  const m = op && /^me-(\d+)$/.exec(op.id || '');
  return m ? Number(m[1]) : null;
}

function corpoCarrinho(pedido, rem, chaveNota, servico) {
  const c = pedido.cliente;
  const e = pedido.entrega;
  const { pacote } = montarPacote(pedido.itens.map((i) => ({ sku: i.sku, qtd: i.qtd })));
  const pj = c.doc.length === 14;

  const corpo = {
    service: servico,
    from: {
      name: rem.nome,
      phone: so(rem.telefone),
      email: rem.email,
      company_document: so(rem.cnpj),
      state_register: chaveNota ? (rem.ie || 'ISENTO') : '',
      economic_activity_code: rem.cnae || undefined,
      address: rem.endereco,
      complement: rem.complemento || undefined,
      number: rem.numero,
      district: rem.bairro,
      city: rem.cidade,
      country_id: 'BR',
      postal_code: so(rem.cep),
      state_abbr: rem.uf,
    },
    to: {
      name: c.nome,
      phone: c.tel,
      email: c.email,
      document: pj ? undefined : c.doc,
      company_document: pj ? c.doc : undefined,
      address: e.rua,
      complement: e.compl || undefined,
      number: e.numero,
      district: e.bairro,
      city: e.cidade,
      country_id: 'BR',
      postal_code: e.cep,
      state_abbr: e.uf,
    },
    products: pedido.itens.map((i) => ({ name: i.nome.slice(0, 100), quantity: String(i.qtd), unitary_value: String(i.preco) })),
    volumes: [{ height: pacote.altura, width: pacote.largura, length: pacote.comprimento, weight: pacote.peso }],
    options: {
      insurance_value: pedido.subtotal,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: !chaveNota,
      platform: 'VM Click',
      tags: [{ tag: pedido.numero, url: null }],
    },
  };
  if (chaveNota) corpo.options.invoice = { key: chaveNota };
  if (SERVICOS_JADLOG.includes(servico) && so(rem.agenciaJadlog)) corpo.agency = Number(so(rem.agenciaJadlog));
  return corpo;
}

/* Grava o andamento da etiqueta no pedido, relendo antes (outro clique ou
   o webhook podem ter mexido nele). */
async function anotarEtiqueta(id, campos) {
  const p = await pedidos.ler(id);
  p.etiqueta = Object.assign({}, p.etiqueta || {}, campos, { em: new Date().toISOString() });
  await pedidos.gravar(p);
  return p;
}

/**
 * Gera (ou continua gerando) a etiqueta do pedido. Devolve o pedido com
 * `etiqueta`: { id, protocolo, preco, etapa, url, rastreio, ambiente }.
 */
async function gerar(id) {
  let pedido = await pedidos.ler(id);
  if (!pedido) throw new ErroEtiqueta(404, 'Pedido não encontrado.');
  if (!['pago', 'separacao'].includes(pedido.status)) {
    throw new ErroEtiqueta(409, 'Só dá para gerar etiqueta de pedido pago (ou em separação).');
  }
  const servico = serviceId(pedido);
  if (!servico) {
    throw new ErroEtiqueta(409, pedido.entrega.aCombinar
      ? 'Frete a combinar: este pedido não tem serviço de transportadora escolhido. Gere a etiqueta no painel do Melhor Envio.'
      : 'Esta entrega não é por transportadora (retirada ou entrega da loja).');
  }

  const et = pedido.etiqueta || {};

  /* 1-2. carrinho (uma vez só) */
  if (!et.id) {
    const rem = await config.remetente();
    const faltando = ['nome', 'cnpj', 'telefone', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'uf']
      .filter((k) => !String(rem[k] || '').trim());
    if (faltando.length) {
      throw new ErroEtiqueta(409, `Complete os dados do remetente em Integrações > Remetente das etiquetas: ${faltando.join(', ')}.`);
    }

    const { ambiente } = await config.melhorEnvio();
    let chave = null;
    try {
      chave = await chaveDaNota(pedido);
    } catch (e) {
      if (e instanceof ErroEtiqueta) throw e;
      throw new ErroEtiqueta(502, `Não deu para ler a nota no Olist: ${e.message}`);
    }
    if (!chave && ambiente === 'producao') {
      throw new ErroEtiqueta(409, 'Emita a nota fiscal no Olist antes. A etiqueta de venda precisa da chave da NF-e autorizada.');
    }

    const { json } = await chamarME('POST', '/api/v2/me/cart', corpoCarrinho(pedido, rem, chave, servico));
    pedido = await anotarEtiqueta(id, {
      id: json.id, protocolo: json.protocol, preco: Number(json.price) || null,
      etapa: 'carrinho', ambiente, comNota: Boolean(chave),
    });
  }

  const idME = pedido.etiqueta.id;

  /* 3. compra com o saldo */
  if (pedido.etiqueta.etapa === 'carrinho') {
    try {
      await chamarME('POST', '/api/v2/me/shipment/checkout', { orders: [idME] });
    } catch (e) {
      /* já pago numa tentativa anterior que caiu antes de anotar: segue */
      if (!(e instanceof ErroFrete && /paga/i.test(e.message))) {
        throw new ErroEtiqueta(e.status === 422 ? 409 : 502,
          `${e.message} Se for saldo, adicione saldo no Melhor Envio e clique de novo: a etiqueta continua de onde parou.`);
      }
    }
    pedido = await anotarEtiqueta(id, { etapa: 'paga' });
  }

  /* 4. geração */
  if (pedido.etiqueta.etapa === 'paga') {
    const { json } = await chamarME('POST', '/api/v2/me/shipment/generate', { orders: [idME] });
    const r = json && json[idME];
    if (r && r.status === false) throw new ErroEtiqueta(502, `Melhor Envio não gerou a etiqueta: ${r.message || 'sem detalhe'}`);
    pedido = await anotarEtiqueta(id, { etapa: 'gerada' });
  }

  /* 5. link de impressão (privado: só abre logado no Melhor Envio, porque a
     etiqueta tem nome e endereço do cliente) e rastreio */
  const impressao = await chamarME('POST', '/api/v2/me/shipment/print', { orders: [idME], mode: 'private' });
  let rastreio = pedido.etiqueta.rastreio || null;
  try {
    const t = await chamarME('POST', '/api/v2/me/shipment/tracking', { orders: [idME] });
    const info = t.json && t.json[idME];
    if (info && info.tracking) rastreio = info.tracking;
  } catch (e) { /* rastreio pode vir depois; o link de impressão já serve */ }

  pedido = await anotarEtiqueta(id, { url: impressao.json && impressao.json.url, rastreio });

  /* etiqueta pronta = pedido em separação, se ainda estava só pago */
  if (pedido.status === 'pago') {
    pedido = (await pedidos.mudarStatus(id, 'separacao', 'etiqueta')) || pedido;
  }
  return pedido;
}

module.exports = { gerar, ErroEtiqueta };
