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
 *   1. Vercel KV / Upstash Redis, se as variáveis estiverem configuradas.
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

function temKV() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function podeGravarLocal() {
  /* na Vercel o sistema de arquivos é somente leitura fora de /tmp */
  return !process.env.VERCEL;
}

async function kv(comando) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/${comando.join('/')}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
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
      await kv(['set', CHAVE, encodeURIComponent(token)]);
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
