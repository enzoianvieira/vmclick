#!/usr/bin/env node
/**
 * VM Click - Olist ERP OAuth2 token helper
 *
 * Modos:
 *   node scripts/get-token.js              → authorization_code (browser + servidor local)
 *   node scripts/get-token.js --refresh    → refresh_token (renova sem browser)
 *
 * Escreve access_token e refresh_token no .env preservando outras chaves.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const AUTH_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth';
const TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

const MODE_REFRESH = process.argv.includes('--refresh');

// -------- .env util (parser + writer preservando ordem/comentários) --------
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

// -------- HTTP helpers --------
function postForm(url, params) {
  return new Promise((resolve, reject) => {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    })
      .then(async (res) => {
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }
        if (!res.ok) {
          const detail = json ? `${json.error || ''}: ${json.error_description || text}` : text;
          return reject(new Error(`HTTP ${res.status} — ${detail}`));
        }
        resolve(json);
      })
      .catch(reject);
  });
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === 'win32') cmd = `start "" "${url}"`;
  else if (platform === 'darwin') cmd = `open "${url}"`;
  else cmd = `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn(`  ! falha ao abrir browser: ${err.message}\n    abra manualmente: ${url}`);
  });
}

// -------- Env check --------
if (!fs.existsSync(ENV_PATH)) {
  console.error('ERRO: .env não existe. Rode: cp .env.example .env');
  process.exit(1);
}

const env = parseEnv(readEnvLines());
const CLIENT_ID = env.TINY_CLIENT_ID;
const CLIENT_SECRET = env.TINY_CLIENT_SECRET;
const REDIRECT_URI = env.TINY_REDIRECT_URI || 'http://localhost:3000/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERRO: TINY_CLIENT_ID e TINY_CLIENT_SECRET obrigatórios em .env');
  process.exit(1);
}

// -------- Refresh flow --------
async function runRefresh() {
  const refreshToken = env.TINY_REFRESH_TOKEN;
  if (!refreshToken) {
    console.error('ERRO: TINY_REFRESH_TOKEN vazio em .env. Rode sem --refresh pra fazer flow completo.');
    process.exit(1);
  }

  console.log('Renovando access_token via refresh_token...');
  const json = await postForm(TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  saveTokens(json);
}

// -------- Authorization code flow --------
async function runAuthCode() {
  const port = new URL(REDIRECT_URI).port || 3000;
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'openid',
    response_type: 'code',
    state,
  });
  const authUrl = `${AUTH_URL}?${params.toString()}`;

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const parsed = new URL(req.url, `http://localhost:${port}`);
      if (parsed.pathname !== new URL(REDIRECT_URI).pathname) {
        res.writeHead(404); res.end('Not found');
        return;
      }
      const receivedCode = parsed.searchParams.get('code');
      const receivedState = parsed.searchParams.get('state');
      const error = parsed.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Erro OAuth</h1><p>${error}: ${parsed.searchParams.get('error_description') || ''}</p>`);
        server.close();
        return reject(new Error(`OAuth erro: ${error}`));
      }
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
      res.end(`<!doctype html><meta charset="utf-8"><title>OK</title>
        <body style="font-family:system-ui;padding:2rem;max-width:520px;margin:auto">
        <h1>Autorização recebida ✓</h1>
        <p>Pode fechar esta aba. Volte pro terminal.</p>`);
      server.close();
      resolve(receivedCode);
    });

    server.listen(port, () => {
      console.log(`Servidor local: http://localhost:${port}`);
      console.log('Abrindo browser pra autorizar...');
      console.log(`Se não abrir, cole no navegador:\n  ${authUrl}\n`);
      openBrowser(authUrl);
    });

    server.on('error', reject);
    setTimeout(() => {
      server.close();
      reject(new Error('Timeout: 5 min sem callback'));
    }, 5 * 60 * 1000);
  });

  console.log('Code recebido. Trocando por tokens...');
  const json = await postForm(TOKEN_URL, {
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
  const access = json.access_token;
  const refresh = json.refresh_token;
  const expiresIn = json.expires_in;
  const refreshExpiresIn = json.refresh_expires_in;

  if (!access) {
    console.error('ERRO: resposta sem access_token:', JSON.stringify(json).slice(0, 400));
    process.exit(1);
  }

  const updates = { TINY_ACCESS_TOKEN: access };
  if (refresh) updates.TINY_REFRESH_TOKEN = refresh;
  upsertEnv(updates);

  console.log('\n✓ Tokens gravados em .env');
  console.log(`  access_token:  ${access.slice(0, 12)}... (expira em ${expiresIn || '?'}s)`);
  if (refresh) {
    console.log(`  refresh_token: ${refresh.slice(0, 12)}... (expira em ${refreshExpiresIn || '?'}s)`);
  }
  console.log('\nPróximo passo: npm run sync-tiny');
}

// -------- Main --------
(async () => {
  try {
    if (MODE_REFRESH) await runRefresh();
    else await runAuthCode();
  } catch (err) {
    console.error('\nFALHA:', err.message);
    process.exit(1);
  }
})();
