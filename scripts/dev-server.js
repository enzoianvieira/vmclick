#!/usr/bin/env node
/**
 * VM Click - servidor de desenvolvimento
 *
 * POR QUE EXISTE
 * O `http-server` só entrega arquivos: em POST /api/... ele responde 405. Como
 * o painel administrativo depende das funções de api/, sem isto o login nunca
 * passa. Este servidor faz as duas coisas ao mesmo tempo:
 *
 *   /api/...  -> executa o arquivo correspondente em api/
 *   resto     -> entrega o arquivo estático
 *
 * Ele imita o que a Vercel faz em produção: monta req.body já convertido e
 * oferece res.status().json(). Assim o mesmo código roda aqui e lá, sem
 * adaptação.
 *
 * Uso: npm run dev
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORTA = Number(process.env.PORT) || 4321;

/* -------------------------------------------------------------- .env ------ */
function carregarEnv() {
  const arquivo = path.join(ROOT, '.env');
  if (!fs.existsSync(arquivo)) return [];
  const carregadas = [];
  for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const chave = t.slice(0, i).trim();
    let valor = t.slice(i + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    process.env[chave] = valor;
    carregadas.push(chave);
  }
  return carregadas;
}

/* ------------------------------------------------------------ estático ---- */
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.ico': 'image/x-icon',
};

function servirArquivo(req, res, caminhoUrl) {
  let rel = decodeURIComponent(caminhoUrl.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';

  /* impede subir diretórios com ../ e sair da pasta do projeto */
  const destino = path.normalize(path.join(ROOT, rel));
  if (!destino.startsWith(ROOT)) {
    res.writeHead(403).end('Acesso negado');
    return;
  }

  fs.readFile(destino, (err, dados) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404</h1><p>Arquivo não encontrado: ' + rel + '</p>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(dados);
  });
}

/* ------------------------------------------------------------- funções ---- */

/** Acrescenta ao res os atalhos que a Vercel oferece. */
function prepararResposta(res) {
  res.status = (codigo) => { res.statusCode = codigo; return res; };
  res.json = (obj) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function lerCorpo(req) {
  return new Promise((resolve) => {
    let bruto = '';
    req.on('data', (p) => { bruto += p; });
    req.on('end', () => {
      if (!bruto) return resolve(undefined);
      try { resolve(JSON.parse(bruto)); } catch { resolve(bruto); }
    });
  });
}

async function rodarFuncao(req, res, caminhoUrl) {
  const semQuery = caminhoUrl.split('?')[0];
  const rel = semQuery.replace(/^\/api\//, '');
  const arquivo = path.join(ROOT, 'api', rel + '.js');

  if (!fs.existsSync(arquivo)) {
    return prepararResposta(res).status(404).json({ erro: 'Endpoint não existe: ' + semQuery });
  }

  /* recarrega a cada chamada para editar código sem reiniciar o servidor */
  delete require.cache[require.resolve(arquivo)];
  for (const chave of Object.keys(require.cache)) {
    if (chave.includes(path.join(ROOT, 'api'))) delete require.cache[chave];
  }

  try {
    const handler = require(arquivo);
    req.body = await lerCorpo(req);
    await handler(req, prepararResposta(res));
  } catch (err) {
    console.error('  ! erro em ' + semQuery + ':', err.message);
    if (!res.headersSent) prepararResposta(res).status(500).json({ erro: err.message });
  }
}

/* ---------------------------------------------------------------- boot ---- */
const carregadas = carregarEnv();

const servidor = http.createServer((req, res) => {
  const url = req.url || '/';
  if (url.startsWith('/api/')) {
    console.log(`  ${req.method} ${url}`);
    return rodarFuncao(req, res, url);
  }
  return servirArquivo(req, res, url);
});

servidor.listen(PORTA, () => {
  const faltando = ['ADMIN_USUARIO', 'ADMIN_SENHA_HASH', 'SESSAO_SEGREDO']
    .filter((v) => !process.env[v]);

  console.log('');
  console.log(`VM Click rodando em http://localhost:${PORTA}`);
  console.log(`  site    http://localhost:${PORTA}/index.html`);
  console.log(`  painel  http://localhost:${PORTA}/admin/`);
  console.log('');
  console.log(`.env: ${carregadas.length} variáveis carregadas`);

  if (faltando.length) {
    console.log('');
    console.log('  ATENÇÃO: o login do painel não vai funcionar.');
    console.log('  Faltam estas variáveis no .env: ' + faltando.join(', '));
    console.log('  Gere com: node scripts/gerar-senha-admin.js "usuario" "senha"');
  }
  console.log('');
});
