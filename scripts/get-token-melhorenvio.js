#!/usr/bin/env node
/**
 * VM Click - Melhor Envio OAuth2 token helper
 *
 * Modos:
 *   node scripts/get-token-melhorenvio.js            → authorization_code
 *   node scripts/get-token-melhorenvio.js --refresh  → renova sem browser
 *
 * Existe para resolver a única parte manual da integração de frete: pegar o
 * primeiro refresh_token. Depois disso a função em api/_frete.js renova
 * sozinha e guarda o token rotacionado no KV.
 *
 * Antes de rodar, no painel do Melhor Envio:
 *   - criar o aplicativo e copiar Client ID e Client Secret para o .env;
 *   - cadastrar a URL de redirecionamento EXATAMENTE igual à de
 *     MELHORENVIO_REDIRECT_URI.
 *
 * O Melhor Envio só aceita redirecionamento em https, então não dá para apontar
 * para o servidor local deste script. Com uma URL remota (o padrão), a
 * autorização cai em /api/callback-melhorenvio no site publicado, que mostra o
 * código na tela para você colar aqui no terminal. Se a URL for de localhost, o
 * script volta a capturar o código sozinho.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');

const MODE_REFRESH = process.argv.includes('--refresh');

/* Cotar precisa só disto. Emitir etiqueta, mais adiante, vai pedir também
   shipping-checkout, shipping-generate e shipping-print. */
const SCOPE_PADRAO = 'shipping-calculate';

// -------- .env util (mesmo formato do get-token.js do Olist) --------
function readEnvLines() {
  if (!fs.existsSync(ENV_PATH)) return [];
  return fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
}

function parseEnv(lines) {
  const env = {};
  for (const line of lines) {
    const trim = line.trim();
    if (!trim || trim.startsWith('#')) continue;
    const eq = trim.indexOf('=');
    if (eq === -1) continue;
    const key = trim.slice(0, eq).trim();
    let val = trim.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function upsertEnv(updates) {
  const lines = readEnvLines();
  const seen = new Set();

  const newLines = lines.map((line) => {
    const trim = line.trim();
    if (!trim || trim.startsWith('#')) return line;
    const eq = trim.indexOf('=');
    if (eq === -1) return line;
    const key = trim.slice(0, eq).trim();
    if (key in updates) {
      seen.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  for (const [key, val] of Object.entries(updates)) {
    if (!seen.has(key)) newLines.push(`${key}=${val}`);
  }

  fs.writeFileSync(ENV_PATH, newLines.join('\n'), 'utf8');
}

// -------- HTTP --------
/* O Melhor Envio troca token em JSON, não em form-urlencoded como o Olist. */
async function postJson(url, corpo) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(corpo),
  });
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* resposta não-JSON cai no erro abaixo */ }

  if (!res.ok) {
    const detalhe = json ? `${json.error || ''}: ${json.error_description || json.message || texto}` : texto;
    throw new Error(`HTTP ${res.status} — ${detalhe.slice(0, 300)}`);
  }
  return json;
}

function openBrowser(url) {
  const plataforma = process.platform;
  let cmd;
  if (plataforma === 'win32') cmd = `start "" "${url}"`;
  else if (plataforma === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn(`  ! falha ao abrir browser: ${err.message}`);
  });
}

/** Pergunta no terminal e devolve a resposta sem espaços nas pontas. */
function perguntar(rotulo) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(rotulo, (resposta) => {
      rl.close();
      resolve(String(resposta || '').trim());
    });
  });
}

// -------- Env check --------
if (!fs.existsSync(ENV_PATH)) {
  console.error('ERRO: .env não existe. Rode: cp .env.example .env');
  process.exit(1);
}

const env = parseEnv(readEnvLines());
const CLIENT_ID = env.MELHORENVIO_CLIENT_ID;
const CLIENT_SECRET = env.MELHORENVIO_CLIENT_SECRET;
const REDIRECT_URI = env.MELHORENVIO_REDIRECT_URI
  || 'https://vmclick.vercel.app/api/callback-melhorenvio';
const SCOPE = env.MELHORENVIO_SCOPE || SCOPE_PADRAO;

/* sandbox por padrão: ninguém deve descobrir o fluxo direto em produção */
const BASE = env.MELHORENVIO_AMBIENTE === 'producao'
  ? 'https://melhorenvio.com.br'
  : 'https://sandbox.melhorenvio.com.br';

const AUTH_URL = `${BASE}/oauth/authorize`;
const TOKEN_URL = `${BASE}/oauth/token`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERRO: MELHORENVIO_CLIENT_ID e MELHORENVIO_CLIENT_SECRET obrigatórios em .env');
  process.exit(1);
}

/* Só dá para escutar o callback aqui se ele apontar para esta máquina. */
function ehLocal(uri) {
  try {
    const h = new URL(uri).hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch (e) {
    return false;
  }
}

// -------- Refresh --------
async function runRefresh() {
  const refreshToken = env.MELHORENVIO_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('ERRO: MELHORENVIO_REFRESH_TOKEN vazio em .env. Rode sem --refresh pra fazer o flow completo.');
    process.exit(1);
  }

  console.log(`Renovando access_token (${BASE})...`);
  const json = await postJson(TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  saveTokens(json);
}

// -------- Authorization code --------

/* Caminho normal: o Melhor Envio exige https, então a autorização volta para a
   página publicada, que mostra o código para você colar aqui. */
async function pegarCodigoColado(authUrl, state) {
  console.log(`Ambiente:          ${BASE}`);
  console.log(`Redirecionamento:  ${REDIRECT_URI}`);
  console.log('');
  console.log(`state desta sessão: ${state}`);
  console.log('  A página de retorno mostra o state. Se lá aparecer outro,');
  console.log('  cancele e rode de novo: a resposta pode não ser do seu pedido.');
  console.log('');
  console.log('Abrindo o browser pra autorizar...');
  console.log('Se não abrir, cole no navegador:');
  console.log(`  ${authUrl}`);
  console.log('');
  openBrowser(authUrl);

  const code = await perguntar('Cole o código exibido na página e tecle Enter:\n> ');
  if (!code) throw new Error('Nenhum código informado.');
  return code;
}

/* Alternativa, usada só quando o redirecionamento aponta para localhost. */
function pegarCodigoEscutando(authUrl, state) {
  const port = new URL(REDIRECT_URI).port || 3000;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = new URL(req.url, `http://localhost:${port}`);
      if (parsed.pathname !== new URL(REDIRECT_URI).pathname) {
        res.writeHead(404); res.end('Not found');
        return;
      }

      const receivedCode = parsed.searchParams.get('code');
      const receivedState = parsed.searchParams.get('state');
      const erro = parsed.searchParams.get('error');

      if (erro) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Erro OAuth</h1><p>${erro}</p>`);
        server.close();
        return reject(new Error(`OAuth erro: ${erro}`));
      }
      /* state diferente do enviado: a resposta não veio do fluxo que abrimos */
      if (receivedState !== state) {
        res.writeHead(400); res.end('State inválido (CSRF).');
        server.close();
        return reject(new Error('State inválido — possível CSRF'));
      }
      if (!receivedCode) {
        res.writeHead(400); res.end('Sem code.');
        server.close();
        return reject(new Error('Callback sem code'));
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>OK</title>'
        + '<body style="font-family:system-ui;padding:2rem">'
        + '<h1>Autorização recebida</h1><p>Pode fechar. Volte pro terminal.</p>');
      server.close();
      resolve(receivedCode);
    });

    server.listen(port, () => {
      console.log(`Ambiente: ${BASE}`);
      console.log(`Servidor local: http://localhost:${port}`);
      console.log('Abrindo browser pra autorizar...');
      console.log('Se não abrir, cole no navegador:');
      console.log(`  ${authUrl}`);
      openBrowser(authUrl);
    });

    server.on('error', reject);
    setTimeout(() => {
      server.close();
      reject(new Error('Timeout: 5 min sem callback'));
    }, 5 * 60 * 1000);
  });
}

async function runAuthCode() {
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state,
    scope: SCOPE,
  });
  const authUrl = `${AUTH_URL}?${params.toString()}`;

  const code = ehLocal(REDIRECT_URI)
    ? await pegarCodigoEscutando(authUrl, state)
    : await pegarCodigoColado(authUrl, state);

  console.log('');
  console.log('Trocando o código por tokens...');
  const json = await postJson(TOKEN_URL, {
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code,
  });

  saveTokens(json);
}

// -------- Persistência --------
function saveTokens(json) {
  const access = json && json.access_token;
  const refresh = json && json.refresh_token;

  if (!access) {
    console.error('ERRO: resposta sem access_token:', JSON.stringify(json).slice(0, 400));
    process.exit(1);
  }

  const updates = { MELHORENVIO_ACCESS_TOKEN: access };
  if (refresh) updates.MELHORENVIO_REFRESH_TOKEN = refresh;
  upsertEnv(updates);

  console.log('');
  console.log('✓ Tokens gravados em .env');
  console.log(`  access_token:  ${access.slice(0, 12)}... (expira em ${json.expires_in || '?'}s)`);
  if (refresh) console.log(`  refresh_token: ${refresh.slice(0, 12)}...`);

  console.log('');
  console.log('Próximos passos:');
  console.log('  1. Copie MELHORENVIO_REFRESH_TOKEN para as variáveis da Vercel.');
  console.log('  2. Confirme que o KV está ativo lá — é onde o token rotacionado fica.');
  console.log('  3. Teste local com: npx vercel dev');
}

// -------- Main --------
(async () => {
  try {
    if (MODE_REFRESH) await runRefresh();
    else await runAuthCode();
  } catch (err) {
    console.error('');
    console.error('FALHA:', err.message);
    process.exit(1);
  }
})();
