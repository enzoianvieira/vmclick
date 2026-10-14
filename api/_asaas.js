/**
 * VM Click - gateway de pagamento (Asaas), lado servidor
 *
 * Tudo que fala com o Asaas passa por aqui. O resto do projeto conhece só
 * "pix", "boleto" e "cartao" e as funções deste módulo - trocar de gateway
 * depois (Pagar.me, por exemplo) é reescrever este arquivo, não o checkout.
 *
 * A chave da API movimenta a conta: cria cobrança, estorna, transfere. Fica
 * só no servidor, como o token do Melhor Envio.
 *
 * Cartão não passa por aqui nem pelo site: a cobrança é criada sem dados de
 * cartão e o cliente digita o cartão na fatura hospedada do Asaas
 * (invoiceUrl). Isso mantém a loja fora do escopo pesado do PCI-DSS.
 *
 * Chave e ambiente vêm do painel administrativo (aba Integrações) e, na
 * falta dele, das variáveis de ambiente - ver _config.js:
 *   ASAAS_AMBIENTE      sandbox | producao   (padrão: sandbox)
 *   ASAAS_API_KEY       chave da API ($aact_...)
 *   ASAAS_USER_AGENT    identificação da aplicação, exigida pelo Asaas
 */

const crypto = require('crypto');

const config = require('./_config.js');

const BASES = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

class ErroPagamento extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const TIPO = { pix: 'PIX', boleto: 'BOLETO', cartao: 'CREDIT_CARD' };

/* Status do Asaas que significam dinheiro garantido. CONFIRMED é o cartão
   aprovado (cai em D+30); RECEIVED é o dinheiro já na conta. */
const PAGOS = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'];

/**
 * `cfg` opcional ({ ambiente, chave }) - o painel usa para testar uma chave
 * de um ambiente que não é o que está em uso.
 */
async function chamar(metodo, caminho, corpo, cfg) {
  const c = cfg || await config.asaas();
  if (!c.chave) throw new ErroPagamento(503, 'Pagamento não configurado no servidor');

  const res = await fetch(BASES[c.ambiente] + caminho, {
    method: metodo,
    headers: {
      access_token: c.chave,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      /* contas criadas a partir de nov/2024 recusam chamada sem User-Agent */
      'User-Agent': process.env.ASAAS_USER_AGENT || 'VM Click (contato@vmclick.com.br)',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const texto = await res.text();
  let json = {};
  try { json = JSON.parse(texto); } catch (e) { json = {}; }

  if (!res.ok) {
    const descricao = json.errors && json.errors[0] && json.errors[0].description;
    console.error(`[asaas] ${metodo} ${caminho} -> ${res.status}`, descricao || texto.slice(0, 300));

    if (res.status === 401) {
      throw new ErroPagamento(503, 'Chave do Asaas inválida ou de outro ambiente (sandbox x produção).');
    }
    /* 400 do Asaas vem com descrição legível ("O CPF/CNPJ informado é
       inválido."), que serve ao cliente melhor que um código. */
    if (res.status === 400 && descricao) throw new ErroPagamento(400, descricao);
    throw new ErroPagamento(502, `Asaas respondeu ${res.status}`);
  }

  return json;
}

/* ------------------------------------------------------------- cliente --- */

/**
 * Devolve o id do cliente no Asaas, reaproveitando o cadastro se o documento
 * já existe. O cadastro existente não é alterado: o documento é digitado por
 * um visitante qualquer, e deixar a compra de um sobrescrever e-mail e
 * telefone do cadastro de outro seria um presente para quem quer bagunçar.
 */
async function garantirCliente(c) {
  const busca = await chamar('GET', `/customers?cpfCnpj=${encodeURIComponent(c.doc)}&limit=1`);
  if (busca.data && busca.data[0]) return busca.data[0].id;

  const novo = await chamar('POST', '/customers', {
    name: c.nome,
    cpfCnpj: c.doc,
    email: c.email,
    mobilePhone: c.tel,
    postalCode: c.cep || undefined,
    addressNumber: c.numero || undefined,
    complement: c.compl || undefined,
    /* E-mail e SMS do Asaas ficam desligados: SMS e WhatsApp de cobrança são
       tarifados, e o site já mostra Pix, boleto e status na página do pedido. */
    notificationDisabled: true,
  });
  return novo.id;
}

/* ------------------------------------------------------------ cobrança --- */

/**
 * Cria a cobrança e devolve só o que o resto do projeto usa.
 *
 * `parcelas` > 1 vale para cartão: o Asaas cria um parcelamento e cobra o
 * total no cartão de uma vez, em N parcelas.
 */
async function criarCobranca({ cliente, forma, valor, vencimento, descricao, referencia, parcelas, retorno }) {
  const tipo = TIPO[forma];
  if (!tipo) throw new ErroPagamento(400, 'Forma de pagamento inválida');

  const corpo = {
    customer: cliente,
    billingType: tipo,
    dueDate: vencimento,
    description: descricao,
    externalReference: referencia,
  };

  if (forma === 'cartao' && parcelas > 1) {
    corpo.installmentCount = parcelas;
    corpo.totalValue = valor;
  } else {
    corpo.value = valor;
  }

  /* Volta para a página do pedido depois do cartão. O Asaas só aceita se o
     domínio estiver cadastrado em Minha Conta > Informações comerciais - por
     isso é opcional. */
  if (retorno) corpo.callback = { successUrl: retorno, autoRedirect: true };

  const c = await chamar('POST', '/payments', corpo);
  return {
    id: c.id,
    parcelamento: c.installment || null,
    status: c.status,
    faturaUrl: c.invoiceUrl || null,
    boletoUrl: c.bankSlipUrl || null,
  };
}

async function consultarCobranca(id) {
  const c = await chamar('GET', `/payments/${encodeURIComponent(id)}`);
  return {
    id: c.id,
    status: c.status,
    pago: PAGOS.includes(c.status),
    valor: Number(c.value),
    referencia: c.externalReference || null,
    parcelamento: c.installment || null,
  };
}

/** QR code e copia-e-cola de uma cobrança Pix. */
async function pix(id) {
  const q = await chamar('GET', `/payments/${encodeURIComponent(id)}/pixQrCode`);
  return { imagem: q.encodedImage, copiaECola: q.payload, expira: q.expirationDate || null };
}

/** Linha digitável de um boleto. */
async function linhaDigitavel(id) {
  const b = await chamar('GET', `/payments/${encodeURIComponent(id)}/identificationField`);
  return b.identificationField || null;
}

/* ------------------------------------------------------------- painel --- */

/**
 * Prefixo das chaves novas do Asaas: $aact_hmlg_ é sandbox, $aact_prod_ é
 * produção. Chave antiga sem marca passa; marcada no ambiente errado não.
 */
function chaveCombinaComAmbiente(chave, ambiente) {
  if (/^\$aact_hmlg_/.test(chave)) return ambiente === 'sandbox';
  if (/^\$aact_prod_/.test(chave)) return ambiente === 'producao';
  return true;
}

/** Confere se a chave funciona, lendo o saldo da conta. */
async function testar(cfg) {
  const r = await chamar('GET', '/finance/balance', null, cfg);
  return { saldo: Number(r.balance) || 0 };
}

const EVENTOS_WEBHOOK = [
  'PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_OVERDUE', 'PAYMENT_DELETED',
  'PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE',
];

/**
 * Cria (ou atualiza, se já existe um para a mesma URL) o webhook do site na
 * conta do Asaas, com um token novo. Devolve { id, token } para ser guardado.
 *
 * `interrupted: false` também reativa uma fila que o Asaas tenha pausado.
 */
async function configurarWebhook(url, email, cfg) {
  const token = 'vmc_' + crypto.randomBytes(32).toString('hex');
  const corpo = {
    name: 'VM Click - site',
    url,
    email,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken: token,
    sendType: 'SEQUENTIALLY',
    events: EVENTOS_WEBHOOK,
  };

  const lista = await chamar('GET', '/webhooks?limit=100', null, cfg);
  const existente = (lista.data || []).find((w) => w && w.url === url);

  const r = existente
    ? await chamar('PUT', `/webhooks/${encodeURIComponent(existente.id)}`, corpo, cfg)
    : await chamar('POST', '/webhooks', corpo, cfg);

  return { id: r.id || (existente && existente.id), token, atualizado: Boolean(existente) };
}

module.exports = {
  garantirCliente, criarCobranca, consultarCobranca, pix, linhaDigitavel,
  chaveCombinaComAmbiente, testar, configurarWebhook,
  ErroPagamento, PAGOS,
};
