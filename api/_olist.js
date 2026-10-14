/**
 * VM Click - acesso ao Olist ERP, lado servidor
 *
 * POR QUE ISTO EXISTE NO SERVIDOR
 * O token do Olist dá acesso ao catálogo, aos custos e aos pedidos da empresa.
 * Se ele fosse para o navegador, qualquer visitante abriria o DevTools e o
 * copiaria. Por isso toda chamada ao Olist passa por aqui, e o navegador só
 * conversa com os endpoints deste projeto.
 *
 * Variáveis de ambiente necessárias (painel da Vercel, nunca no repositório):
 *   TINY_CLIENT_ID
 *   TINY_CLIENT_SECRET
 *   TINY_REFRESH_TOKEN
 *
 * O access_token dura 4 horas, então ele é renovado sob demanda e guardado em
 * memória do processo. Em serverless cada instância mantém o seu, o que é
 * suficiente: no pior caso renova de novo.
 */

const credenciais = require('./_credenciais.js');

const API_BASE = 'https://api.tiny.com.br/public-api/v3';
const TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

/* cache do token vivo nesta instância */
let tokenCache = { valor: null, expiraEm: 0 };

async function obterToken(refreshInformado) {
  const agora = Date.now();
  if (!refreshInformado && tokenCache.valor && agora < tokenCache.expiraEm - 60_000) return tokenCache.valor;

  const { TINY_CLIENT_ID, TINY_CLIENT_SECRET } = process.env;
  const refreshAtual = refreshInformado || await credenciais.lerRefreshToken();
  if (!TINY_CLIENT_ID || !TINY_CLIENT_SECRET || !refreshAtual) {
    throw new ErroOlist(500, 'Credenciais do Olist não configuradas no servidor');
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: TINY_CLIENT_ID,
    client_secret: TINY_CLIENT_SECRET,
    refresh_token: refreshAtual,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    if (refreshInformado) {
      throw new ErroOlist(400, 'O Olist recusou este token. Ele vale cerca de 1 dia e só pode ser usado uma vez: rode npm run get-token de novo e cole o TINY_REFRESH_TOKEN novo.');
    }
    /* refresh_token do Olist expira. Quando isso acontece, alguém precisa
       autorizar de novo pelo navegador e atualizar a variável de ambiente. */
    const dica = credenciais.armazenamentoDisponivel()
      ? 'Rode `npm run get-token` e atualize a credencial.'
      : 'Configure o Vercel KV para o token rotacionado ser guardado; sem isso a conexão expira todo dia.';
    throw new ErroOlist(502, `A conexão com o Olist expirou. ${dica}`);
  }

  const json = await res.json();

  /* O Olist rotaciona o refresh token a cada renovação e ele expira em cerca
     de um dia. Guardar o novo é o que mantém a conexão viva; sem isso o painel
     para de funcionar no dia seguinte ao deploy. */
  if (json.refresh_token) await credenciais.gravarRefreshToken(json.refresh_token);

  tokenCache = {
    valor: json.access_token,
    expiraEm: agora + (json.expires_in || 14400) * 1000,
  };
  return tokenCache.valor;
}

/* 403 = o token não tem a permissão. Depois que alguém reautoriza com as
   permissões novas, o token em memória desta instância ainda é o velho:
   esquecê-lo faz a próxima chamada pegar o novo no KV. */
const MSG_403 = 'O aplicativo do Olist não tem permissão para isso. Libere Pedidos e Contatos no aplicativo, autorize de novo e cole o token novo em painel > Integrações > Olist.';

function esquecerToken() {
  tokenCache = { valor: null, expiraEm: 0 };
}

class ErroOlist extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/** GET no Olist já autenticado. `caminho` começa com barra, ex.: '/produtos?limit=10' */
async function olistGet(caminho) {
  const token = await obterToken();
  const res = await fetch(API_BASE + caminho, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (res.status === 429) {
    throw new ErroOlist(429, 'Limite de chamadas do Olist atingido. Tente de novo em alguns segundos.');
  }
  if (res.status === 403) {
    esquecerToken();
    throw new ErroOlist(403, MSG_403);
  }
  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = (j && j.mensagem) || '';
      if (j && Array.isArray(j.detalhes)) msg += ' - ' + j.detalhes.map((d) => `${d.campo}: ${d.mensagem}`).join('; ');
    } catch (e) { /* corpo sem JSON */ }
    throw new ErroOlist(res.status, `Olist respondeu ${res.status}${msg ? ': ' + msg : ''}`);
  }
  return res.json();
}

/**
 * POST/PUT no Olist já autenticado. Usado para lançar os pedidos do site.
 * Exige que o aplicativo do Olist tenha as permissões de Pedidos e Contatos
 * (além de Produtos); sem elas o Olist responde 403.
 */
async function olistEnviar(metodo, caminho, corpo) {
  const token = await obterToken();
  const res = await fetch(API_BASE + caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo || {}),
  });

  if (res.status === 204) return null;
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch (e) { json = null; }

  if (res.status === 403) {
    esquecerToken();
    throw new ErroOlist(403, MSG_403);
  }
  if (res.status === 429) {
    throw new ErroOlist(429, 'Limite de chamadas do Olist atingido. Tente de novo em alguns segundos.');
  }
  if (!res.ok) {
    /* o Olist explica campo a campo o que recusou */
    const det = json && Array.isArray(json.detalhes)
      ? json.detalhes.map((d) => `${d.campo}: ${d.mensagem}`).join('; ')
      : '';
    throw new ErroOlist(res.status, `Olist recusou (${res.status}): ${(json && json.mensagem) || ''}${det ? ' - ' + det : ''}`);
  }
  return json;
}

/**
 * Para o painel: troca o refresh token colado (de uma autorização nova, com
 * as permissões novas) por um par novo, guarda o refresh rotacionado no KV e
 * passa a usar o access token na hora. O token colado é consumido: o Olist
 * rotaciona a cada uso.
 */
async function conectarComRefresh(refresh) {
  esquecerToken();
  await obterToken(String(refresh || '').trim());
}

/** Quais leituras o token atual consegue fazer (sem gravar nada no Olist). */
async function verificarPermissoes() {
  const r = {};
  for (const [nome, caminho] of [['produtos', '/produtos?limit=1'], ['contatos', '/contatos?limit=1'], ['pedidos', '/pedidos?limit=1']]) {
    try { await olistGet(caminho); r[nome] = true; } catch (e) {
      if (e.status === 403) r[nome] = false; else throw e;
    }
  }
  return r;
}

module.exports = { olistGet, olistEnviar, conectarComRefresh, verificarPermissoes, esquecerToken, ErroOlist };
