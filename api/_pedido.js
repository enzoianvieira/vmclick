/**
 * VM Click - pedidos: guarda, ciclo de vida e o que pode ser mostrado
 *
 * Compartilhado entre /api/pedido (cria e consulta) e o webhook do Asaas
 * (confirma, vence, cancela, estorna). As duas pontas mudam o status pelo
 * mesmo caminho, mudarStatus(), que só aceita transições que fazem sentido:
 * um aviso de "vencido" atrasado não pode desfazer um pedido já pago.
 */

const crypto = require('crypto');

const armazem = require('./_armazem.js');

/* Pedido fica guardado meio ano. Depois de pago ele vive no Olist, que é o
   sistema de registro; aqui é só a ponte entre o checkout e o pagamento. */
const VALIDADE_S = 180 * 24 * 3600;

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
  await armazem.gravar(chavePedido(pedido.id), pedido, VALIDADE_S);
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
  vencido: ['aguardando'],
  cancelado: ['aguardando', 'vencido'],
  falhou: ['aguardando'],
  estornado: ['pago', 'contestado'],
  contestado: ['pago'],
};

/**
 * Lê o pedido de novo, aplica a transição se ela for válida e grava.
 * Devolve o pedido atualizado, ou null se a transição não se aplica.
 *
 * Reler logo antes de gravar encurta a janela em que o webhook e a consulta
 * da página do pedido pisam um no outro.
 */
async function mudarStatus(id, novo, origem) {
  const pedido = await ler(id);
  if (!pedido) return null;
  if (pedido.status === novo) return pedido;
  if (!(ORIGENS[novo] || []).includes(pedido.status)) return null;

  pedido.status = novo;
  pedido.historico = (pedido.historico || []).concat({ em: new Date().toISOString(), status: novo, origem });
  if (novo === 'pago') pedido.pagoEm = new Date().toISOString();

  await gravar(pedido);

  /* PRÓXIMO PASSO: pedido pago é o gatilho para lançar o pedido no Olist e,
     depois, comprar a etiqueta no Melhor Envio. Por ora fica no log. */
  if (novo === 'pago') console.log(`[pedido] ${pedido.numero} pago (${origem})`);

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
    pix: aguardando && p.forma === 'pix' ? p.pix || null : null,
    boleto: aguardando && p.forma === 'boleto'
      ? { url: p.asaas && p.asaas.boletoUrl, linha: p.boleto && p.boleto.linha }
      : null,
    faturaUrl: aguardando && p.asaas ? p.asaas.faturaUrl : null,
  };
}

module.exports = {
  novoId, idValido, novoNumero,
  ler, gravar, vincularCobranca, pedidoDaCobranca, mudarStatus, visaoPublica,
};
