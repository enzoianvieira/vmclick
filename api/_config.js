/**
 * VM Click - configuração das integrações (Asaas e Melhor Envio)
 *
 * De onde vêm as chaves:
 *   1. Painel administrativo (aba Integrações), guardadas no KV.
 *   2. Variáveis de ambiente, como antes - continuam valendo quando o painel
 *      ainda não tem nada para aquela integração.
 *
 * Cada integração guarda uma chave por ambiente (teste e produção). Trocar o
 * modo no painel não pede para digitar a chave de novo, e uma chave de teste
 * nunca é usada contra produção por engano.
 *
 * SEGURANÇA
 * As chaves movimentam dinheiro (a do Asaas cria cobrança e estorna; o token
 * do Melhor Envio compra etiqueta com o saldo). Por isso:
 *   - vão cifradas para o KV (AES-256-GCM), com chave derivada de
 *     SESSAO_SEGREDO: quem lê o KV sozinho não lê as chaves;
 *   - nunca voltam para o navegador - o painel vê só "…abcd".
 * Trocar SESSAO_SEGREDO invalida as chaves guardadas: é preciso cadastrá-las
 * de novo no painel.
 */

const crypto = require('crypto');

const armazem = require('./_armazem.js');

const AMBIENTES = ['sandbox', 'producao'];
const chave = (nome) => `vmclick:config:${nome}`;

/* ------------------------------------------------------------ cifra ------ */

function chaveCifra() {
  const segredo = process.env.SESSAO_SEGREDO;
  if (!segredo) throw new Error('SESSAO_SEGREDO não configurado no servidor');
  return Buffer.from(crypto.hkdfSync('sha256', segredo, 'vmclick', 'integracoes-v1', 32));
}

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chaveCifra(), iv);
  const corpo = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), corpo.toString('base64url')].join(':');
}

function decifrar(guardado) {
  if (!guardado) return null;
  try {
    const [versao, iv, tag, corpo] = String(guardado).split(':');
    if (versao !== 'v1') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', chaveCifra(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(corpo, 'base64url')), d.final()]).toString('utf8');
  } catch (e) {
    /* SESSAO_SEGREDO trocado ou dado corrompido: tratado como não cadastrado */
    return null;
  }
}

/** "…abcd" - o bastante para reconhecer qual chave está lá, nada além. */
function mascarar(texto) {
  return texto ? '…' + String(texto).slice(-4) : null;
}

/* ------------------------------------------------------- leitura bruta --- */

/* Cache curto por instância: o checkout consulta a configuração a cada
   chamada, e ir ao KV toda vez seria desperdício. Uma troca feita no painel
   chega às outras instâncias em até 30 s. */
const VALIDADE_CACHE_MS = 30_000;
const cache = new Map();

async function lerBruto(nome) {
  const c = cache.get(nome);
  if (c && Date.now() - c.em < VALIDADE_CACHE_MS) return c.valor;

  let valor = null;
  if (armazem.disponivel()) {
    try { valor = await armazem.ler(chave(nome)); } catch (e) { valor = null; }
  }
  cache.set(nome, { valor, em: Date.now() });
  return valor;
}

async function gravarBruto(nome, valor) {
  await armazem.gravar(chave(nome), valor);
  cache.set(nome, { valor, em: Date.now() });
}

function ambienteValido(a) {
  return AMBIENTES.includes(a) ? a : null;
}

/* --------------------------------------------------------------- Asaas --- */

/**
 * Configuração em uso agora: ambiente, chave da API e tokens do webhook.
 * O painel manda; o que ele não tiver vem das variáveis de ambiente.
 */
async function asaas() {
  const p = (await lerBruto('asaas')) || {};
  const ambiente = ambienteValido(p.ambiente)
    || (process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox');
  const doAmbiente = p[ambiente] || {};

  const chavePainel = decifrar(doAmbiente.chave);
  const tokenPainel = decifrar(doAmbiente.webhookToken);

  /* A variável de ambiente só vale para o ambiente que ela declara: chave de
     sandbox no .env não pode responder por produção escolhida no painel. */
  const envAmbiente = process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox';
  const envVale = envAmbiente === ambiente;

  return {
    ambiente,
    chave: chavePainel || (envVale ? process.env.ASAAS_API_KEY : null) || null,
    origemChave: chavePainel ? 'painel' : (envVale && process.env.ASAAS_API_KEY ? 'ambiente' : null),
    /* O anterior continua aceito: ao reconfigurar o webhook, avisos já na fila
       do Asaas ainda chegam com o token velho. */
    webhookTokens: [tokenPainel, decifrar(doAmbiente.webhookTokenAnterior), envVale ? process.env.ASAAS_WEBHOOK_TOKEN : null]
      .filter(Boolean),
    webhookId: doAmbiente.webhookId || null,
  };
}

/** Chave do Asaas de um ambiente específico - o painel testa antes de ativar. */
async function chaveAsaas(ambiente) {
  const p = (await lerBruto('asaas')) || {};
  const doPainel = decifrar((p[ambiente] || {}).chave);
  if (doPainel) return doPainel;
  const envAmbiente = process.env.ASAAS_AMBIENTE === 'producao' ? 'producao' : 'sandbox';
  return envAmbiente === ambiente ? process.env.ASAAS_API_KEY || null : null;
}

/** Token pessoal do Melhor Envio cadastrado no painel para um ambiente. */
async function tokenMelhorEnvio(ambiente) {
  const p = (await lerBruto('melhorenvio')) || {};
  return decifrar((p[ambiente] || {}).token);
}

/* -------------------------------------------------------- Melhor Envio --- */

async function melhorEnvio() {
  const p = (await lerBruto('melhorenvio')) || {};
  const ambiente = ambienteValido(p.ambiente)
    || (process.env.MELHORENVIO_AMBIENTE === 'producao' ? 'producao' : 'sandbox');
  const token = decifrar((p[ambiente] || {}).token);
  return { ambiente, token: token || null, origemToken: token ? 'painel' : null };
}

/* ------------------------------------------------------- painel: status --- */

/** O que o painel pode ver: ambiente, se há chave e o final dela. */
async function resumo() {
  const a = (await lerBruto('asaas')) || {};
  const m = (await lerBruto('melhorenvio')) || {};
  const atualAsaas = await asaas();
  const atualME = await melhorEnvio();

  const porAmbiente = (bruto, campo) => {
    const r = {};
    for (const amb of AMBIENTES) {
      const valor = decifrar((bruto[amb] || {})[campo]);
      r[amb] = { configurada: Boolean(valor), final: mascarar(valor), em: (bruto[amb] || {}).em || null };
    }
    return r;
  };

  const webhook = {};
  for (const amb of AMBIENTES) {
    const d = a[amb] || {};
    webhook[amb] = { configurado: Boolean(d.webhookId && d.webhookToken), em: d.webhookEm || null };
  }

  return {
    armazenamento: armazem.disponivel(),
    asaas: {
      ambiente: atualAsaas.ambiente,
      origemChave: atualAsaas.origemChave,
      chaves: porAmbiente(a, 'chave'),
      webhook,
    },
    melhorEnvio: {
      ambiente: atualME.ambiente,
      origemToken: atualME.origemToken,
      oauth: Boolean(process.env.MELHORENVIO_CLIENT_ID && process.env.MELHORENVIO_REFRESH_TOKEN),
      ambienteOauth: process.env.MELHORENVIO_AMBIENTE === 'producao' ? 'producao' : 'sandbox',
      tokens: porAmbiente(m, 'token'),
    },
  };
}

/* ---------------------------------------------------- painel: gravação --- */

async function alterar(nome, mudar) {
  if (!armazem.disponivel()) {
    throw new Error('Sem armazenamento (KV) configurado no servidor: não há onde guardar a configuração.');
  }
  const atual = (await lerBruto(nome)) || {};
  /* Lê do KV de novo, sem cache, para não sobrescrever uma alteração feita
     em outra aba nos últimos segundos. */
  const fresco = (await armazem.ler(chave(nome))) || atual;
  const novo = mudar(JSON.parse(JSON.stringify(fresco)));
  novo.atualizadoEm = new Date().toISOString();
  await gravarBruto(nome, novo);
  return novo;
}

function definirAmbiente(nome, ambiente) {
  if (!ambienteValido(ambiente)) throw new Error('Ambiente inválido');
  return alterar(nome, (c) => { c.ambiente = ambiente; return c; });
}

/** `valor` vazio apaga a chave daquele ambiente. */
function definirSegredo(nome, ambiente, campo, valor) {
  if (!ambienteValido(ambiente)) throw new Error('Ambiente inválido');
  return alterar(nome, (c) => {
    c[ambiente] = c[ambiente] || {};
    if (valor) {
      c[ambiente][campo] = cifrar(valor);
      c[ambiente].em = new Date().toISOString();
    } else {
      delete c[ambiente][campo];
      delete c[ambiente].em;
    }
    return c;
  });
}

/** Guarda o token novo do webhook mantendo o anterior aceito. */
function definirWebhook(ambiente, { id, token }) {
  return alterar('asaas', (c) => {
    c[ambiente] = c[ambiente] || {};
    if (c[ambiente].webhookToken) c[ambiente].webhookTokenAnterior = c[ambiente].webhookToken;
    c[ambiente].webhookToken = cifrar(token);
    if (id) c[ambiente].webhookId = id;
    c[ambiente].webhookEm = new Date().toISOString();
    return c;
  });
}

module.exports = {
  AMBIENTES,
  asaas, melhorEnvio, resumo, chaveAsaas, tokenMelhorEnvio,
  definirAmbiente, definirSegredo, definirWebhook,
};
