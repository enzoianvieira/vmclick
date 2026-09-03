/**
 * VM Click - guarda do refresh token do Olist
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * O refresh token do Olist rotaciona: cada renovação devolve um token novo e o
 * anterior deixa de valer pouco depois. Além disso ele expira em cerca de
 * 1 dia. Guardado apenas em variável de ambiente, o painel funcionaria no dia
 * do deploy e quebraria no dia seguinte, porque o servidor recebe o token novo
 * mas variável de ambiente é somente leitura em execução.
 *
 * Então o token rotacionado precisa de um lugar gravável. Aqui há dois modos:
 *
 *   1. Upstash Redis (KV_REST_API_* ou UPSTASH_REDIS_REST_*), se configurado.
 *      É o modo recomendado em produção.
 *   2. Arquivo local, para desenvolvimento na máquina.
 *
 * Sem nenhum dos dois, cai no valor de TINY_REFRESH_TOKEN e avisa que a
 * conexão vai expirar em cerca de um dia.
 */

const fs = require('fs');
const path = require('path');

const CHAVE = 'vmclick:olist:refresh_token';
const ARQUIVO_LOCAL = path.join(__dirname, '..', '.olist-token.json');

/* O nome dessas variáveis muda conforme por onde a integração foi criada, e a
   Vercel ainda permite escolher um prefixo na instalação. Em vez de adivinhar,
   procura primeiro os nomes conhecidos e, se não achar, qualquer par
   *_REST_API_URL / *_REST_API_TOKEN com o mesmo prefixo. Assim funciona com
   prefixo personalizado sem precisar mexer no código. */
function credenciaisKV() {
  const conhecidos = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  ];
  for (const [chaveUrl, chaveToken] of conhecidos) {
    if (process.env[chaveUrl] && process.env[chaveToken]) {
      return { url: process.env[chaveUrl], token: process.env[chaveToken] };
    }
  }

  /* varredura por prefixo: STORAGE_REST_API_URL + STORAGE_REST_API_TOKEN */
  for (const chave of Object.keys(process.env)) {
    const m = chave.match(/^(.*)_REST_API_URL$/);
    if (!m) continue;
    const token = process.env[`${m[1]}_REST_API_TOKEN`];
    if (process.env[chave] && token) {
      return { url: process.env[chave], token };
    }
  }

  return null;
}

function temKV() {
  return Boolean(credenciaisKV());
}

function podeGravarLocal() {
  /* na Vercel o sistema de arquivos é somente leitura fora de /tmp */
  return !process.env.VERCEL;
}

/* `valor` vai no corpo, não na URL: o refresh token tem ~740 caracteres e
   colocá-lo no caminho arrisca esbarrar em limite de tamanho de URL e em
   diferenças de codificação entre proxies. */
async function kv(comando, valor) {
  const cred = credenciaisKV();
  const opcoes = { headers: { Authorization: `Bearer ${cred.token}` } };
  if (valor !== undefined) {
    opcoes.method = 'POST';
    opcoes.body = valor;
  }
  const res = await fetch(`${cred.url}/${comando.join('/')}`, opcoes);
  if (!res.ok) throw new Error(`KV respondeu ${res.status}`);
  return res.json();
}

/** Último refresh token válido conhecido. */
async function lerRefreshToken() {
  if (temKV()) {
    try {
      const r = await kv(['get', CHAVE]);
      if (r && r.result) return r.result;
    } catch (e) { /* cai para o ambiente abaixo */ }
  }

  if (podeGravarLocal()) {
    try {
      if (fs.existsSync(ARQUIVO_LOCAL)) {
        const j = JSON.parse(fs.readFileSync(ARQUIVO_LOCAL, 'utf8'));
        if (j && j.refresh_token) return j.refresh_token;
      }
    } catch (e) { /* idem */ }
  }

  return process.env.TINY_REFRESH_TOKEN || '';
}

/** Guarda o token rotacionado. Sem isso a conexão morre no dia seguinte. */
async function gravarRefreshToken(token) {
  if (!token) return { onde: 'nenhum' };

  if (temKV()) {
    try {
      await kv(['set', CHAVE], token);
      return { onde: 'kv' };
    } catch (e) { /* tenta o arquivo */ }
  }

  if (podeGravarLocal()) {
    try {
      fs.writeFileSync(ARQUIVO_LOCAL, JSON.stringify({ refresh_token: token, em: new Date().toISOString() }, null, 2));
      return { onde: 'arquivo' };
    } catch (e) { /* segue */ }
  }

  return { onde: 'nenhum' };
}

/** Diz se existe lugar para guardar o token rotacionado. */
function armazenamentoDisponivel() {
  return temKV() || podeGravarLocal();
}

module.exports = { lerRefreshToken, gravarRefreshToken, armazenamentoDisponivel };
