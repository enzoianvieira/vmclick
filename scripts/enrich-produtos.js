#!/usr/bin/env node
/**
 * VM Click - Enriquece produtos com detalhe completo do Olist ERP
 *
 * Uso:
 *   npm run enrich-produtos             # roda todos (usa cache)
 *   npm run enrich-produtos:dry         # simula, não grava data/produtos.js
 *   npm run enrich-produtos -- --force  # ignora cache e rebaixa tudo
 *
 * Requisitos:
 *   1. npm run get-token (com permissões: Produtos, Marcas, Estoque, Categorias)
 *   2. npm run fetch-categorias
 *   3. Revisar scripts/categoria-map.json
 *
 * Fluxo:
 *   [1] Lista IDs via GET /produtos?situacao=A (paginado)
 *   [2] Pra cada ID → GET /produtos/{id} (com cache em scripts/.cache/)
 *   [3] Mapeia usando categoria-map.json
 *   [4] Reescreve data/produtos.js (backup em .bak)
 *
 * Endpoint /produtos/{id} retorna TUDO num só request: marca, categoria,
 * dimensões, preços, estoque, anexos (imagens). Nenhum call extra.
 *
 * Tempo estimado: ~50min pra 5775 produtos (limitado por rate limit).
 * Interrompido? Cache preserva progresso; roda de novo continua de onde parou.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const PRODUTOS_PATH = path.join(ROOT, 'data', 'produtos.js');
const PRODUTOS_BAK = path.join(ROOT, 'data', 'produtos.js.bak');
const MARCAS_PATH = path.join(ROOT, 'data', 'marcas.js');
const CACHE_DIR = path.join(__dirname, '.cache');
const CATS_PATH = path.join(__dirname, 'categorias.json');
const MAP_LEGACY_PATH = path.join(__dirname, 'categoria-map.json');
const REGRAS = require('./regras-catalogo.js');

const API_BASE = 'https://api.tiny.com.br/public-api/v3';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const CACHE_ONLY = args.includes('--cache-only');

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

const TOKEN = process.env.TINY_ACCESS_TOKEN;
const PAGE_SIZE = Math.min(parseInt(process.env.TINY_PAGE_SIZE || '100', 10), 100);
const SITUACAO = process.env.TINY_SITUACAO || 'A';

if (!TOKEN) {
  console.error('ERRO: TINY_ACCESS_TOKEN vazio. Rode: npm run get-token');
  process.exit(1);
}

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// -------- Utils --------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function humanTime(sec) {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m${s}s`;
}

// -------- Categorias (novo formato: scripts/categorias.json) --------
function loadCategorias() {
  if (fs.existsSync(CATS_PATH)) {
    const raw = JSON.parse(fs.readFileSync(CATS_PATH, 'utf8'));
    return {
      slugs: Array.isArray(raw.slugs) ? raw.slugs : [],
      mapping: raw.mapping && typeof raw.mapping === 'object' ? raw.mapping : {},
    };
  }
  // Fallback: formato antigo (categoria-map.json)
  if (fs.existsSync(MAP_LEGACY_PATH)) {
    console.warn('  ! usando categoria-map.json antigo — rode `npm run fetch-categorias` pra atualizar');
    const raw = JSON.parse(fs.readFileSync(MAP_LEGACY_PATH, 'utf8'));
    const m = raw.mapping || {};
    const mapping = {};
    for (const [id, v] of Object.entries(m)) if (v && v.slug) mapping[id] = v.slug;
    return { slugs: [], mapping };
  }
  console.warn('  ! sem mapping de categorias — todas caem no fallback.');
  return { slugs: [], mapping: {} };
}

const ICONE_POR_SLUG = {
  eletrica: 'p-disjuntor',
  iluminacao: 'p-lampada',
  hidraulica: 'p-registro',
  utilidades: 'p-alicate',
  pintura: 'p-tinta',
  ferramentas: 'p-alicate',
  vestuarios: 'p-caixa',
};

// Fallback só usado se categoria do Olist não estiver no mapping.
// Escolhe primeira categoria disponível ou 'sem-categoria'.
function fallbackSlug(slugs) {
  return (slugs[0] && slugs[0].slug) || 'sem-categoria';
}

// -------- HTTP com rate limit --------
let bucketRemaining = 999;
let bucketReset = 0;

async function apiGet(pathAndQuery, attempt = 1) {
  const url = `${API_BASE}${pathAndQuery}`;

  // Pausa proativa se bucket baixo
  if (bucketRemaining <= 2 && bucketReset > 0) {
    process.stdout.write(`\n  ↻ rate limit baixo, pausando ${bucketReset}s...`);
    await sleep((bucketReset + 1) * 1000);
    bucketRemaining = 999;
    bucketReset = 0;
  }

  let res;
  try {
    res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' },
    });
  } catch (err) {
    if (attempt < 4) {
      await sleep(3000 * attempt);
      return apiGet(pathAndQuery, attempt + 1);
    }
    throw err;
  }

  const rem = parseInt(res.headers.get('x-ratelimit-remaining') || '', 10);
  const rst = parseInt(res.headers.get('x-ratelimit-reset') || '', 10);
  if (Number.isFinite(rem)) bucketRemaining = rem;
  if (Number.isFinite(rst)) bucketReset = rst;

  if (res.status === 401) throw new Error('HTTP 401 — token expirado. Rode: npm run get-token:refresh');
  if (res.status === 403) throw new Error('HTTP 403 — permissão faltando no aplicativo Olist.');
  if (res.status === 404) return null;

  if (res.status === 429) {
    const wait = (rst > 0 ? rst : 30) * 1000;
    process.stdout.write(`\n  ↻ HTTP 429, aguardando ${wait / 1000}s...`);
    await sleep(wait);
    return apiGet(pathAndQuery, attempt + 1);
  }

  if (res.status >= 500 && attempt < 4) {
    await sleep(5000 * attempt);
    return apiGet(pathAndQuery, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

// -------- Listagem de IDs --------
async function listarTodosIds() {
  const ids = [];
  let offset = 0;
  let total = null;

  for (;;) {
    process.stdout.write(`\r  → listando offset ${offset}${total !== null ? `/${total}` : ''}...`.padEnd(60));
    const q = new URLSearchParams({ situacao: SITUACAO, limit: String(PAGE_SIZE), offset: String(offset) }).toString();
    const json = await apiGet(`/produtos?${q}`);
    const itens = (json && json.itens) || [];
    const pag = (json && json.paginacao) || {};
    if (typeof pag.total === 'number') total = pag.total;

    for (const p of itens) if (p && p.id) ids.push(p.id);

    if (itens.length < PAGE_SIZE) break;
    if (total !== null && ids.length >= total) break;
    offset += PAGE_SIZE;
  }
  process.stdout.write('\n');
  return ids;
}

// -------- Detalhe (com cache) --------
function cachePath(id) {
  return path.join(CACHE_DIR, `produto-${id}.json`);
}

async function detalheProduto(id) {
  const cp = cachePath(id);
  if (!FORCE && fs.existsSync(cp)) {
    try {
      return { data: JSON.parse(fs.readFileSync(cp, 'utf8')), cached: true };
    } catch {}
  }

  const json = await apiGet(`/produtos/${id}`);
  if (json) fs.writeFileSync(cp, JSON.stringify(json), 'utf8');
  return { data: json, cached: false };
}

// -------- Detecção de sub-categoria por palavra-chave --------
function detectarSubCategoria(nome) {
  if (!nome) return null;
  for (const r of REGRAS) {
    if (r.match.test(nome)) return r.slug;
  }
  return null;
}

// -------- Map API → schema local --------
function mapDetalhe(d, cats) {
  if (!d) return null;

  const marca = d.marca && d.marca.nome ? d.marca.nome : '';
  const catId = d.categoria && d.categoria.id ? String(d.categoria.id) : null;
  const catPath = d.categoria && d.categoria.caminhoCompleto ? d.categoria.caminhoCompleto : (d.categoria && d.categoria.nome) || '';

  const catTopLevel = (catId && cats.mapping[catId]) || fallbackSlug(cats.slugs);
  const subCat = detectarSubCategoria(d.descricao || '');
  const cat = subCat || catTopLevel;

  const precos = d.precos || {};
  const preco = toNumber(precos.preco, 0);
  const precoPromo = toNumber(precos.precoPromocional, 0);
  const emPromo = precoPromo > 0 && precoPromo < preco;

  const estoque = (d.estoque && toInt(d.estoque.quantidade, 0)) || 0;
  const dim = d.dimensoes || {};

  const specs = {};
  if (marca) specs['Marca'] = marca;
  if (d.gtin) specs['GTIN'] = String(d.gtin);
  if (d.ncm) specs['NCM'] = String(d.ncm);
  if (dim.largura) specs['Largura'] = `${dim.largura} cm`;
  if (dim.altura) specs['Altura'] = `${dim.altura} cm`;
  if (dim.comprimento) specs['Comprimento'] = `${dim.comprimento} cm`;
  if (dim.pesoLiquido) specs['Peso líquido'] = `${dim.pesoLiquido} kg`;
  if (dim.pesoBruto) specs['Peso bruto'] = `${dim.pesoBruto} kg`;
  if (d.unidadePorCaixa) specs['Un. por caixa'] = String(d.unidadePorCaixa);
  if (d.garantia) specs['Garantia'] = d.garantia;
  if (catPath) specs['Categoria (Olist)'] = catPath;

  const anexos = Array.isArray(d.anexos) ? d.anexos : [];
  const imagens = anexos.map((a) => a && a.url).filter(Boolean);

  return {
    sku: d.sku || String(d.id),
    slug: (d.seo && d.seo.slug) ? d.seo.slug : slugify(d.descricao || d.sku || String(d.id)),
    cat,
    nome: d.descricao || '',
    marca,
    preco: emPromo ? precoPromo : preco,
    precoDe: emPromo ? preco : null,
    estoque,
    icone: ICONE_POR_SLUG[cat] || 'p-alicate',
    imagens,
    novo: false,
    destaque: false,
    nota: 0,
    avaliacoes: 0,
    unidade: d.unidade || 'un',
    desc: stripHtml(d.descricaoComplementar || ''),
    specs,
  };
}

// -------- Escrita --------
function buildCategoriasBlock(slugsTopLevel, produtos) {
  // Junta top-level (Olist) + sub-categorias detectadas que TÊM produtos
  const slugsUsados = new Set(produtos.map((p) => p.cat));
  const all = [];

  for (const c of slugsTopLevel) {
    if (slugsUsados.has(c.slug)) all.push(c);
  }
  for (const r of REGRAS) {
    if (slugsUsados.has(r.slug)) {
      all.push({ slug: r.slug, nome: r.nome, curto: r.curto || r.nome, icone: r.icone || 'p-alicate', desc: r.desc || '' });
    }
  }

  if (!all.length) return '[]';
  const items = all.map((c) => {
    return `  {
    slug: ${JSON.stringify(c.slug)},
    nome: ${JSON.stringify(c.nome)},
    curto: ${JSON.stringify(c.curto || c.nome)},
    icone: ${JSON.stringify(c.icone || 'p-alicate')},
    desc: ${JSON.stringify(c.desc || '')}
  }`;
  });
  return `[\n${items.join(',\n')}\n]`;
}

// -------- Extração de marcas top-N --------
const CORES_MARCA = ['#0B4DA2','#2E9E45','#C8102E','#0066B3','#D62027','#E2661A','#B07A00','#D50032','#007D8A','#2B2B2B','#E06A00','#0067B1','#1B7F3B','#B3261E','#1F4E79','#C2410C'];

function buildMarcas(produtos, top = 20) {
  const cont = new Map();
  for (const p of produtos) {
    if (!p.marca) continue;
    cont.set(p.marca, (cont.get(p.marca) || 0) + 1);
  }
  const ordenadas = [...cont.entries()].sort((a, b) => b[1] - a[1]).slice(0, top);
  return ordenadas.map(([nome, qtd], i) => ({
    n: nome,
    c: CORES_MARCA[i % CORES_MARCA.length],
    qtd,
  }));
}

function writeMarcasJs(marcas) {
  const header = `/* Gerado por scripts/enrich-produtos.js — top ${marcas.length} marcas extraídas do catálogo Olist. */\n\n`;
  const body = `window.VM_MARCAS = [\n${marcas.map((m) =>
    `  { n: ${JSON.stringify(m.n)}, c: ${JSON.stringify(m.c)}, qtd: ${m.qtd} }`
  ).join(',\n')}\n];\n`;
  if (DRY_RUN) return;
  fs.writeFileSync(MARCAS_PATH, header + body, 'utf8');
  console.log(`  ✓ marcas: ${path.relative(ROOT, MARCAS_PATH)} (${marcas.length} marcas)`);
}

function stringifyProduto(p) {
  const specsStr = Object.keys(p.specs).length
    ? `{ ${Object.entries(p.specs).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`
    : '{}';
  const imagensStr = p.imagens.length ? `[${p.imagens.map((u) => JSON.stringify(u)).join(',')}]` : '[]';
  return `  {
    sku: ${JSON.stringify(p.sku)}, slug: ${JSON.stringify(p.slug)}, cat: ${JSON.stringify(p.cat)},
    nome: ${JSON.stringify(p.nome)}, marca: ${JSON.stringify(p.marca)},
    preco: ${p.preco.toFixed(2)}, precoDe: ${p.precoDe === null ? 'null' : p.precoDe.toFixed(2)}, estoque: ${p.estoque}, icone: ${JSON.stringify(p.icone)},
    imagens: ${imagensStr},
    novo: ${p.novo}, destaque: ${p.destaque}, nota: ${p.nota}, avaliacoes: ${p.avaliacoes}, unidade: ${JSON.stringify(p.unidade)},
    desc: ${JSON.stringify(p.desc)},
    specs: ${specsStr}
  }`;
}

function writeProdutosJs(catsBlock, produtos) {
  const header = `/* ==========================================================================
   VM Click - catálogo sincronizado do Olist ERP (API v3)
   --------------------------------------------------------------------------
   ARQUIVO GERADO POR scripts/enrich-produtos.js — NÃO EDITE À MÃO.
   Última sincronização: ${new Date().toISOString()}
   Total de produtos: ${produtos.length}
   Ordenação: com estoque + imagem primeiro; esgotados por último.
   ========================================================================== */\n\n`;

  const catBlock = `window.VM_CATEGORIAS = ${catsBlock};\n\n`;
  const prodBlock = `window.VM_PRODUTOS = [\n${produtos.map(stringifyProduto).join(',\n')}\n];\n`;
  const content = header + catBlock + prodBlock;

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] arquivo NÃO gravado. Geraria ${produtos.length} produtos, ${content.length} bytes.`);
    if (produtos.length > 0) {
      console.log('[DRY RUN] amostra:');
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

// -------- Cache-only: lê tudo do disco, zero requests --------
function loadFromCacheOnly() {
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.startsWith('produto-') && f.endsWith('.json'));
  const detalhes = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(CACHE_DIR, f), 'utf8');
      const data = JSON.parse(raw);
      if (data) detalhes.push(data);
    } catch {}
  }
  return detalhes;
}

// -------- Main --------
(async () => {
  const t0 = Date.now();
  console.log(`VM Click — enrich Olist ERP${DRY_RUN ? ' (dry run)' : ''}${FORCE ? ' [FORCE: ignora cache]' : ''}${CACHE_ONLY ? ' [CACHE-ONLY: sem requests]' : ''}`);

  const cats = loadCategorias();
  console.log(`  categorias: ${cats.slugs.length} top-level, ${Object.keys(cats.mapping).length} mapeadas`);

  let detalhes;

  if (CACHE_ONLY) {
    console.log('\n[1/2] lendo cache local (sem requests ao Olist)...');
    detalhes = loadFromCacheOnly();
    console.log(`  ✓ ${detalhes.length} produtos lidos do cache`);
  } else {
    console.log('\n[1/3] listando IDs de produtos...');
    const ids = await listarTodosIds();
    console.log(`  ✓ ${ids.length} IDs`);

    console.log('\n[2/3] baixando detalhe (cache em scripts/.cache/)...');
    detalhes = [];
    const stats = { hit: 0, miss: 0, fail: 0 };
    const t1 = Date.now();

    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i];
      const elapsed = (Date.now() - t1) / 1000;
      const rate = i > 0 ? i / elapsed : 0;
      const eta = rate > 0 ? (ids.length - i) / rate : 0;

      process.stdout.write(
        `\r  → ${i + 1}/${ids.length} | hit:${stats.hit} miss:${stats.miss} fail:${stats.fail} | rem:${bucketRemaining} | ETA ${humanTime(eta)}    `
      );

      try {
        const { data, cached } = await detalheProduto(id);
        if (cached) stats.hit += 1; else stats.miss += 1;
        if (data) detalhes.push(data);
      } catch (err) {
        stats.fail += 1;
        console.warn(`\n  ! id=${id} falhou: ${err.message}`);
      }
    }
    process.stdout.write('\n');
    console.log(`  ✓ ${detalhes.length} detalhes prontos (${stats.hit} cache, ${stats.miss} baixados, ${stats.fail} falhas)`);
  }

  console.log(`\n[${CACHE_ONLY ? '2/2' : '3/3'}] mapeando e gravando...`);
  const mapeados = detalhes.map((d) => mapDetalhe(d, cats)).filter(Boolean);

  // Ordenar: (imagem+estoque) → (imagem sem estoque) → (sem imagem c/ estoque) → esgotados sem imagem
  mapeados.sort((a, b) => {
    const aImg = a.imagens.length > 0 ? 1 : 0;
    const bImg = b.imagens.length > 0 ? 1 : 0;
    const aStk = a.estoque > 0 ? 1 : 0;
    const bStk = b.estoque > 0 ? 1 : 0;
    // Prioridade: estoque primeiro (>0 antes de =0), depois imagem (com antes de sem)
    if (bStk !== aStk) return bStk - aStk;
    if (bImg !== aImg) return bImg - aImg;
    return (a.nome || '').localeCompare(b.nome || '');
  });

  const catsBlock = buildCategoriasBlock(cats.slugs, mapeados);
  writeProdutosJs(catsBlock, mapeados);

  // Gera data/marcas.js (top 20 marcas do catálogo)
  const marcas = buildMarcas(mapeados, 20);
  writeMarcasJs(marcas);

  console.log(`\nConcluído em ${humanTime((Date.now() - t0) / 1000)}.`);
})().catch((err) => {
  console.error('\nFALHA:', err.message);
  process.exit(1);
});
