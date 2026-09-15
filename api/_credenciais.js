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

/* Outras integrações que também rotacionam token guardam aqui, cada uma com a
   sua chave e o seu arquivo local. Ver lerToken/gravarToken no final. */
const ARQUIVOS_POR_CHAVE = {
  [CHAVE]: ARQUIVO_LOCAL,
  'vmclick:melhorenvio:refresh_token': path.join(__dirname, '..', '.melhorenvio-token.json'),
};

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

/** Último refresh token válido conhecido de uma integração qualquer. */
async function lerToken(chave, padraoEnv) {
  if (temKV()) {
    try {
      const r = await kv(['get', chave]);
      if (r && r.result) return r.result;
    } catch (e) { /* cai para o ambiente abaixo */ }
  }

  if (podeGravarLocal()) {
    try {
      const arquivo = ARQUIVOS_POR_CHAVE[chave];
      if (arquivo && fs.existsSync(arquivo)) {
        const j = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
        if (j && j.refresh_token) return j.refresh_token;
      }
    } catch (e) { /* idem */ }
  }

  return padraoEnv || '';
}

/** Guarda o token rotacionado. Sem isso a conexão morre quando ele expira. */
async function gravarToken(chave, token) {
  if (!token) return { onde: 'nenhum' };

  if (temKV()) {
    try {
      await kv(['set', chave], token);
      return { onde: 'kv' };
    } catch (e) { /* tenta o arquivo */ }
  }

  if (podeGravarLocal()) {
    try {
      const arquivo = ARQUIVOS_POR_CHAVE[chave];
      if (arquivo) {
        fs.writeFileSync(arquivo, JSON.stringify({ refresh_token: token, em: new Date().toISOString() }, null, 2));
        return { onde: 'arquivo' };
      }
    } catch (e) { /* segue */ }
  }

  return { onde: 'nenhum' };
}

/* ---------------------------------------------------------------------------
   Guarda genérica de objeto JSON, na mesma prateleira.

   O access_token do Melhor Envio dura 30 dias, mas cada renovação ROTACIONA o
   refresh token. Renovar a cada partida a frio da função gastaria um refresh
   token por vez, e qualquer instância que ficasse para trás levaria 401.
   Guardando o access_token junto com o vencimento, a renovação passa a ser
   rara - que é o comportamento pretendido.
   --------------------------------------------------------------------------- */

async function lerJson(chave) {
  if (temKV()) {
    try {
      const r = await kv(['get', chave]);
      if (r && r.result) return JSON.parse(r.result);
    } catch (e) { /* cai para o ambiente abaixo */ }
  }

  if (podeGravarLocal()) {
    try {
      const arquivo = ARQUIVOS_POR_CHAVE[chave];
      if (arquivo && fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    } catch (e) { /* idem */ }
  }

  return null;
}

async function gravarJson(chave, objeto) {
  const texto = JSON.stringify({ ...objeto, em: new Date().toISOString() });

  if (temKV()) {
    try {
      await kv(['set', chave], texto);
      return { onde: 'kv' };
    } catch (e) { /* tenta o arquivo */ }
  }

  if (podeGravarLocal()) {
    try {
      const arquivo = ARQUIVOS_POR_CHAVE[chave];
      if (arquivo) {
        fs.writeFileSync(arquivo, texto);
        return { onde: 'arquivo' };
      }
    } catch (e) { /* segue */ }
  }

  return { onde: 'nenhum' };
}

/** Atalhos do Olist, que era o único usuário disto antes do frete. */
function lerRefreshToken() {
  return lerToken(CHAVE, process.env.TINY_REFRESH_TOKEN);
}
function gravarRefreshToken(token) {
  return gravarToken(CHAVE, token);
}

/** Diz se existe lugar para guardar o token rotacionado. */
function armazenamentoDisponivel() {
  return temKV() || podeGravarLocal();
}

module.exports = {
  lerRefreshToken, gravarRefreshToken,
  lerToken, gravarToken,
  lerJson, gravarJson,
  armazenamentoDisponivel,
};
