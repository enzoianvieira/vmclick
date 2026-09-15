#!/usr/bin/env node
/**
 * VM Click - Sync Olist ERP API v3 (OAuth2 Bearer) → data/produtos.js
 *
 * Uso:
 *   npm run sync-tiny            # sync completo
 *   npm run sync-tiny:dry        # simula, não grava
 *
 * Requisitos: Node >= 18 (fetch nativo), .env com TINY_ACCESS_TOKEN.
 *
 * Fluxo:
 *   GET https://api.tiny.com.br/public-api/v3/produtos?situacao=A&limit=100&offset=N
 *   Repete até offset >= total. Respeita X-RateLimit-Remaining.
 *   Preserva window.VM_CATEGORIAS, sobrescreve window.VM_PRODUTOS.
 *   Backup do arquivo anterior em data/produtos.js.bak.
 *
 * Limitação do endpoint /produtos (list): NÃO retorna marca, categoria,
 * descrição longa, specs nem imagens. Só id, sku, descricao (nome), preços,
 * unidade, situação, GTIN. Para enriquecer, seria necessário GET /produtos/{id}
 * por item — não implementado nesta versão (usuário pediu "somente listar").
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const PRODUTOS_PATH = path.join(ROOT, 'data', 'produtos.js');
const PRODUTOS_BAK = path.join(ROOT, 'data', 'produtos.js.bak');

const API_BASE = 'https://api.tiny.com.br/public-api/v3';
const DRY_RUN = process.argv.includes('--dry-run');

// -------- .env loader --------
function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  const txt = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const trim = line.trim();
    if (!trim || trim.startsWith('#')) continue;
    const eq = trim.indexOf('=');
    if (eq === -1) continue;
    const key = trim.slice(0, eq).trim();
    let val = trim.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const ACCESS_TOKEN = process.env.TINY_ACCESS_TOKEN;
const PAGE_SIZE = Math.min(parseInt(process.env.TINY_PAGE_SIZE || '100', 10), 100);
const SITUACAO = process.env.TINY_SITUACAO || 'A';

if (!ACCESS_TOKEN || ACCESS_TOKEN === 'cole_seu_access_token_aqui') {
  console.error('ERRO: TINY_ACCESS_TOKEN ausente em .env. Copie .env.example e preencha.');
  process.exit(1);
}

// -------- Utils --------
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function toNumber(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// -------- Categoria: sem info na listagem, cai no fallback --------
const FALLBACK_CAT = 'utilidades';
const CAT_ICONE = {
  eletrica: 'p-raio',
  iluminacao: 'p-lampada',
  hidraulica: 'p-registro',
  utilidades: 'p-alicate',
  pintura: 'p-tinta',
};

// -------- Chamada HTTP com respeito ao rate limit --------
async function tinyGet(query, attempt = 1) {
  const url = `${API_BASE}/produtos?${new URLSearchParams(query).toString()}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    if (attempt < 4) {
      const wait = 3000 * attempt;
      console.warn(`  ↻ rede falhou (${err.message}), retry em ${wait}ms`);
      await sleep(wait);
      return tinyGet(query, attempt + 1);
    }
    throw err;
  }

  const remaining = parseInt(res.headers.get('x-ratelimit-remaining') || '999', 10);
  const reset = parseInt(res.headers.get('x-ratelimit-reset') || '0', 10);

  if (res.status === 401) {
    throw new Error('HTTP 401 — access token inválido ou expirado. Renove pelo refresh token.');
  }
  if (res.status === 429) {
    const wait = (reset > 0 ? reset : 30) * 1000;
    console.warn(`  ↻ HTTP 429 rate limit, aguardando ${wait / 1000}s`);
    await sleep(wait);
    return tinyGet(query, attempt + 1);
  }
  if (res.status >= 500 && attempt < 4) {
    const wait = 5000 * attempt;
    console.warn(`  ↻ HTTP ${res.status}, retry em ${wait}ms`);
    await sleep(wait);
    return tinyGet(query, attempt + 1);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  return { json, remaining, reset };
}

async function listAllProducts() {
  const all = [];
  let offset = 0;
  let total = null;

  for (;;) {
    process.stdout.write(`\r  → offset ${offset}${total !== null ? `/${total}` : ''}...`.padEnd(60));
    const { json, remaining, reset } = await tinyGet({
      situacao: SITUACAO,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });

    const itens = (json && json.itens) || [];
    const pag = (json && json.paginacao) || {};
    total = typeof pag.total === 'number' ? pag.total : total;

    for (const p of itens) all.push(p);

    if (itens.length < PAGE_SIZE) break;
    if (total !== null && all.length >= total) break;

    offset += PAGE_SIZE;

    if (remaining <= 3 && reset > 0) {
      console.warn(`\n  ↻ rate limit baixo (${remaining} restantes), pausando ${reset}s`);
      await sleep((reset + 1) * 1000);
    } else {
      await sleep(200);
    }
  }

  process.stdout.write('\n');
  return all;
}

// -------- Map API → schema local --------
function mapProduct(p) {
  const precos = p.precos || {};
  const preco = toNumber(precos.preco, 0);
  const precoPromo = toNumber(precos.precoPromocional, 0);
  const cat = FALLBACK_CAT;

  return {
    sku: p.sku || String(p.id),
    slug: slugify(p.descricao || p.sku || String(p.id)),
    cat,
    nome: p.descricao || '',
    marca: '',
    preco: precoPromo > 0 && precoPromo < preco ? precoPromo : preco,
    precoDe: precoPromo > 0 && precoPromo < preco ? preco : null,
    estoque: 0,
    icone: CAT_ICONE[cat],
    novo: false,
    destaque: false,
    nota: 0,
    avaliacoes: 0,
    unidade: p.unidade || 'un',
    desc: '',
    specs: p.gtin ? { GTIN: String(p.gtin) } : {},
  };
}

// -------- Escrita --------
function readExistingCategorias() {
  if (!fs.existsSync(PRODUTOS_PATH)) return null;
  const txt = fs.readFileSync(PRODUTOS_PATH, 'utf8');
  const m = txt.match(/window\.VM_CATEGORIAS\s*=\s*(\[[\s\S]*?\]);/);
  return m ? m[1] : null;
}

function stringifyProduto(p) {
  const specsStr = Object.keys(p.specs).length
    ? `{ ${Object.entries(p.specs).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`
    : '{}';
  return `  {
    sku: ${JSON.stringify(p.sku)}, slug: ${JSON.stringify(p.slug)}, cat: ${JSON.stringify(p.cat)},
    nome: ${JSON.stringify(p.nome)}, marca: ${JSON.stringify(p.marca)},
    preco: ${p.preco.toFixed(2)}, precoDe: ${p.precoDe === null ? 'null' : p.precoDe.toFixed(2)}, estoque: ${p.estoque}, icone: ${JSON.stringify(p.icone)},
    novo: ${p.novo}, destaque: ${p.destaque}, nota: ${p.nota}, avaliacoes: ${p.avaliacoes}, unidade: ${JSON.stringify(p.unidade)},
    desc: ${JSON.stringify(p.desc)},
    specs: ${specsStr}
  }`;
}

function writeProdutosJs(categoriasBlock, produtos) {
  const header = `/* ==========================================================================
   VM Click - catálogo sincronizado do Olist ERP (API v3)
   --------------------------------------------------------------------------
   ARQUIVO GERADO POR scripts/sync-tiny.js — NÃO EDITE À MÃO.
   Última sincronização: ${new Date().toISOString()}
   Total de produtos: ${produtos.length}
   ========================================================================== */\n\n`;

  const catBlock = categoriasBlock
    ? `window.VM_CATEGORIAS = ${categoriasBlock};\n\n`
    : `window.VM_CATEGORIAS = [];\n\n`;

  const prodBlock = `window.VM_PRODUTOS = [\n${produtos.map(stringifyProduto).join(',\n')}\n];\n`;

  const content = header + catBlock + prodBlock;

  if (DRY_RUN) {
    console.log('\n[DRY RUN] arquivo NÃO foi gravado.');
    console.log(`[DRY RUN] geraria ${produtos.length} produtos, ${content.length} bytes.`);
    if (produtos.length > 0) {
      console.log('[DRY RUN] amostra primeiro produto:');
      console.log(stringifyProduto(produtos[0]));
    }
    return;
  }

  if (fs.existsSync(PRODUTOS_PATH)) {
    fs.copyFileSync(PRODUTOS_PATH, PRODUTOS_BAK);
    console.log(`  ✓ backup: ${path.relative(ROOT, PRODUTOS_BAK)}`);
  }

  fs.writeFileSync(PRODUTOS_PATH, content, 'utf8');
  console.log(`  ✓ escrito: ${path.relative(ROOT, PRODUTOS_PATH)} (${produtos.length} produtos)`);
}

// -------- Main --------
async function main() {
  const t0 = Date.now();
  console.log(`VM Click — sync Olist ERP v3${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  token: ${ACCESS_TOKEN.slice(0, 8)}...${ACCESS_TOKEN.slice(-6)} (${ACCESS_TOKEN.length} chars)`);
  console.log(`  situação: ${SITUACAO} | page size: ${PAGE_SIZE}`);

  console.log('\n[1/2] listando produtos...');
  const lista = await listAllProducts();
  console.log(`  ✓ ${lista.length} produtos recebidos`);

  console.log('\n[2/2] mapeando e gravando...');
  const mapeados = lista.map(mapProduct);
  const categoriasBlock = readExistingCategorias();
  if (!categoriasBlock) console.warn('  ! VM_CATEGORIAS não encontrado — usando [].');
  writeProdutosJs(categoriasBlock, mapeados);

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nConcluído em ${dt}s.`);
}

main().catch((err) => {
  console.error('\nFALHA:', err.message);
  process.exit(1);
});
