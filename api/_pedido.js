/**
 * VM Click - pedidos: guarda, ciclo de vida e o que pode ser mostrado
 *
 * Compartilhado entre /api/pedido (cria e consulta) e o webhook do Asaas
 * (confirma, vence, cancela, estorna). As duas pontas mudam o status pelo
 * mesmo caminho, mudarStatus(), que só aceita transições que fazem sentido:
 * um aviso de "vencido" atrasado não pode desfazer um pedido já pago.
 *
 * Ciclo de um pedido:
 *   aguardando -> pago -> separacao -> enviado -> entregue
 *   aguardando -> vencido | cancelado | falhou | recusado
 *   pago (ou depois) -> estornado | contestado
 * Na retirada na loja, "enviado" é "pronto para retirar" e "entregue" é
 * "retirado".
 *
 * Pago é o gatilho para lançar o pedido no Olist (_expedicao.js).
 */

const crypto = require('crypto');

const armazem = require('./_armazem.js');
const expedicao = require('./_expedicao.js');

/* Pedido não expira: é o histórico que o painel e o "Meus pedidos" mostram.
   Os vínculos de cobrança, que só servem ao webhook, duram meio ano. */
const VALIDADE_S = 180 * 24 * 3600;

const INDICE_TODOS = 'vmclick:pedidos:todos';

/* O e-mail vai para a chave como hash: nome de chave aparece em painel de
   banco, log e backup, e não precisa expor o e-mail de ninguém. */
function chaveCliente(email) {
  const h = crypto.createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex').slice(0, 32);
  return `vmclick:cliente:${h}:pedidos`;
}

const chavePedido = (id) => `vmclick:pedido:${id}`;
const chaveCobranca = (id) => `vmclick:asaas:cobranca:${id}`;
const chaveParcelamento = (id) => `vmclick:asaas:parcelamento:${id}`;

/* 128 bits aleatórios: o id vai na URL da página do pedido e é o que dá
   acesso a ela, então não pode ser sequencial nem adivinhável. */
function novoId() {
  return crypto.randomBytes(16).toString('base64url');
}

function idValido(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{22}$/.test(id);
}

/** Número curto para o cliente falar no WhatsApp: VM-10001, VM-10002... */
async function novoNumero() {
  const n = await armazem.incrementar('vmclick:pedido:sequencia');
  return `VM-${10000 + n}`;
}

async function ler(id) {
  if (!idValido(id)) return null;
  return armazem.ler(chavePedido(id));
}

async function gravar(pedido) {
  await armazem.gravar(chavePedido(pedido.id), pedido);
}

/** Entra nas listas do painel e do cliente. Chamado uma vez, na criação. */
async function registrar(pedido) {
  const quando = Date.parse(pedido.criadoEm) || Date.now();
  await armazem.indexar(INDICE_TODOS, pedido.id, quando);
  await armazem.indexar(chaveCliente(pedido.cliente.email), pedido.id, quando);
}

async function lerLista(ids) {
  const lidos = await armazem.lerVarios(ids.map(chavePedido));
  return lidos.filter(Boolean);
}

/** Os `quantos` pedidos mais recentes da loja. */
async function recentes(quantos) {
  return lerLista(await armazem.listarIndice(INDICE_TODOS, 0, quantos - 1));
}

/** Pedidos de um cliente, pelo e-mail usado na compra. */
async function doCliente(email, quantos) {
  return lerLista(await armazem.listarIndice(chaveCliente(email), 0, (quantos || 50) - 1));
}

/** Liga a cobrança (e o parcelamento, no cartão) ao pedido. */
async function vincularCobranca(pedido, cobranca) {
  await armazem.gravar(chaveCobranca(cobranca.id), pedido.id, VALIDADE_S);
  if (cobranca.parcelamento) {
    await armazem.gravar(chaveParcelamento(cobranca.parcelamento), pedido.id, VALIDADE_S);
  }
}

/**
 * Acha o pedido de uma cobrança do Asaas. O externalReference é o caminho
 * normal; os vínculos guardados cobrem parcela de cartão, que nem sempre
 * repete a referência da cobrança original.
 */
async function pedidoDaCobranca(cobranca) {
  if (idValido(cobranca.externalReference)) return cobranca.externalReference;
  if (cobranca.id) {
    const id = await armazem.ler(chaveCobranca(cobranca.id));
    if (id) return id;
  }
  if (cobranca.installment) {
    const id = await armazem.ler(chaveParcelamento(cobranca.installment));
    if (id) return id;
  }
  return null;
}

/* De onde cada status pode vir. Ausente aqui = transição recusada. */
const ORIGENS = {
  pago: ['aguardando', 'vencido'],
  separacao: ['pago'],
  enviado: ['pago', 'separacao'],
  entregue: ['enviado'],
  vencido: ['aguardando'],
  cancelado: ['aguardando', 'vencido'],
  falhou: ['aguardando'],
  recusado: ['aguardando'],
  estornado: ['pago', 'separacao', 'contestado'],
  contestado: ['pago', 'separacao', 'enviado', 'entregue'],
};

/** Grava campos no pedido relendo antes, para não pisar em outra mudança. */
async function anotar(id, campos) {
  const pedido = await ler(id);
  if (!pedido) return null;
  Object.assign(pedido, campos);
  await gravar(pedido);
  return pedido;
}

/**
 * Lança no Olist e anota o resultado no pedido. Falhar não desfaz nada:
 * o erro fica em `olistErro` e o painel oferece tentar de novo.
 */
async function enviarAoOlist(id) {
  const pedido = await ler(id);
  if (!pedido) return null;
  try {
    const olist = await expedicao.enviarAoOlist(pedido);
    console.log(`[pedido] ${pedido.numero} lançado no Olist como ${olist.numero}`);
    return anotar(id, { olist, olistErro: null });
  } catch (e) {
    console.error(`[pedido] ${pedido.numero} não foi para o Olist:`, e.message);
    return anotar(id, { olistErro: { mensagem: e.message, em: new Date().toISOString() } });
  }
}

/**
 * Lê o pedido de novo, aplica a transição se ela for válida e grava.
 * Devolve o pedido atualizado, ou null se a transição não se aplica.
 *
 * Reler logo antes de gravar encurta a janela em que o webhook e a consulta
 * da página do pedido pisam um no outro.
 */
async function mudarStatus(id, novo, origem, extra) {
  let pedido = await ler(id);
  if (!pedido) return null;
  if (pedido.status === novo) return pedido;
  if (!(ORIGENS[novo] || []).includes(pedido.status)) return null;

  const agora = new Date().toISOString();
  pedido.status = novo;
  pedido.historico = (pedido.historico || []).concat({ em: agora, status: novo, origem });
  if (novo === 'pago') pedido.pagoEm = agora;
  if (novo === 'enviado') pedido.enviadoEm = agora;
  if (novo === 'entregue') pedido.entregueEm = agora;
  if (extra && extra.rastreio) pedido.rastreio = extra.rastreio;

  await gravar(pedido);

  if (novo === 'pago') {
    console.log(`[pedido] ${pedido.numero} pago (${origem})`);
    pedido = (await enviarAoOlist(id)) || pedido;
  }
  if (novo === 'enviado' && pedido.rastreio) {
    await expedicao.despachoNoOlist(pedido).catch((e) => console.error('[pedido] rastreio no Olist:', e.message));
  }

  return pedido;
}

/**
 * O que a página do pedido pode ver. Quem tem o link vê itens, valores e
 * como pagar - nunca nome, documento, e-mail, telefone ou endereço.
 */
function visaoPublica(p) {
  const aguardando = p.status === 'aguardando';
  return {
    numero: p.numero,
    status: p.status,
    forma: p.forma,
    parcelas: p.parcelas || 1,
    criadoEm: p.criadoEm,
    itens: p.itens.map((i) => ({ nome: i.nome, qtd: i.qtd, sub: i.sub })),
    subtotal: p.subtotal,
    frete: p.frete,
    freteACombinar: Boolean(p.entrega.aCombinar),
    desconto: p.desconto,
    total: p.total,
    entrega: { servico: p.entrega.opcao.servico, tipo: p.entrega.opcao.tipo, prazo: p.entrega.opcao.prazo },
    pagoEm: p.pagoEm || null,
    enviadoEm: p.enviadoEm || null,
    entregueEm: p.entregueEm || null,
    rastreio: p.rastreio || null,
    pix: aguardando && p.forma === 'pix' ? p.pix || null : null,
    boleto: aguardando && p.forma === 'boleto'
      ? { url: p.asaas && p.asaas.boletoUrl, linha: p.boleto && p.boleto.linha }
      : null,
  };
}

module.exports = {
  novoId, idValido, novoNumero,
  ler, gravar, registrar, recentes, doCliente, anotar,
  vincularCobranca, pedidoDaCobranca, mudarStatus, enviarAoOlist, visaoPublica,
};
