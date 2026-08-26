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

async function obterToken() {
  const agora = Date.now();
  if (tokenCache.valor && agora < tokenCache.expiraEm - 60_000) return tokenCache.valor;

  const { TINY_CLIENT_ID, TINY_CLIENT_SECRET } = process.env;
  const refreshAtual = await credenciais.lerRefreshToken();
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
  if (!res.ok) {
    throw new ErroOlist(res.status, `Olist respondeu ${res.status}`);
  }
  return res.json();
}

module.exports = { olistGet, ErroOlist };
