#!/usr/bin/env node
/**
 * VM Click - Baixa árvore de categorias do Olist e gera:
 *   - scripts/categorias-olist.json    → árvore bruta (referência)
 *   - scripts/categorias.json          → slugs + mapping (usado pelo enrich)
 *
 * Regra:
 *   Cada categoria TOP-LEVEL do Olist vira uma categoria do site.
 *   Cada subcategoria é mapeada pro slug da sua top-level ancestral.
 *
 * Ex.:  "1. Elétrica > Iluminação > Led > Bulbo"  → slug "eletrica"
 *       "3. Utilidades > Limpeza > Sabão > ..."   → slug "utilidades"
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const RAW_PATH = path.join(__dirname, 'categorias-olist.json');
const CATS_PATH = path.join(__dirname, 'categorias.json');

const API = 'https://api.tiny.com.br/public-api/v3/categorias/todas';

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
if (!TOKEN) {
  console.error('ERRO: TINY_ACCESS_TOKEN vazio. Rode: npm run get-token');
  process.exit(1);
}

// -------- Icone/descrição por keyword do nome da top-level --------
const ICON_RULES = [
  { match: /el[eé]tric/i, icone: 'p-disjuntor' },
  { match: /ilumina|l[aâ]mpada|led/i, icone: 'p-lampada' },
  { match: /hidr[aá]ulic|tubo|cano/i, icone: 'p-registro' },
  { match: /pintura|tinta/i, icone: 'p-tinta' },
  { match: /ferramenta/i, icone: 'p-alicate' },
  { match: /utilidade|limpeza|casa/i, icone: 'p-alicate' },
  { match: /vestu[aá]ri|roupa|camiseta/i, icone: 'p-caixa' },
];

function icone(nome) {
  for (const r of ICON_RULES) if (r.match.test(nome)) return r.icone;
  return 'p-alicate';
}

function slugify(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^\d+[\.\-\s]+/, '')            // remove "1. ", "2 - " etc do começo
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

function nomeLimpo(desc) {
  return String(desc || '').replace(/^\d+[\.\-\s]+/, '').trim();
}

async function fetchArvore() {
  const res = await fetch(API, {
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' },
  });
  if (res.status === 401) throw new Error('HTTP 401 — token expirado. Rode: npm run get-token:refresh');
  if (res.status === 403) throw new Error('HTTP 403 — permissão "Categorias" não liberada.');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function walk(node, slug, mapping) {
  mapping[String(node.id)] = slug;
  for (const filho of node.filhas || []) walk(filho, slug, mapping);
}

(async () => {
  console.log('Baixando árvore de categorias...');
  const arvore = await fetchArvore();
  fs.writeFileSync(RAW_PATH, JSON.stringify(arvore, null, 2), 'utf8');
  console.log(`  ✓ árvore bruta: ${path.relative(ROOT, RAW_PATH)}`);

  const raiz = Array.isArray(arvore) ? arvore : (arvore.itens || arvore.categorias || []);
  const slugs = [];
  const mapping = {};
  const usadosSlug = new Set();

  for (const top of raiz) {
    const nomeBase = nomeLimpo(top.descricao);
    let slug = slugify(nomeBase);
    if (!slug) slug = `cat-${top.id}`;
    // Evita colisão de slug entre top-levels diferentes
    let n = 2;
    const original = slug;
    while (usadosSlug.has(slug)) { slug = `${original}-${n}`; n += 1; }
    usadosSlug.add(slug);

    slugs.push({
      slug,
      nome: nomeBase,
      curto: nomeBase,
      icone: icone(nomeBase),
      desc: `Produtos da categoria ${nomeBase} disponíveis em estoque.`,
      olistId: top.id,
    });

    walk(top, slug, mapping);
  }

  const out = {
    _instrucoes: [
      'Gerado automaticamente por fetch-categorias.js.',
      '"slugs" é a lista de categorias do site (uma por top-level do Olist).',
      '"mapping" traduz cada categoria Olist (por ID) pro slug da sua top-level ancestral.',
      'Você pode editar "nome", "curto", "desc" e "icone" dos slugs à vontade — enrich preserva.',
    ],
    slugs,
    mapping,
  };

  fs.writeFileSync(CATS_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`  ✓ categorias.json: ${path.relative(ROOT, CATS_PATH)}`);

  console.log(`\n${slugs.length} categorias top-level → viram categorias do site:`);
  for (const s of slugs) {
    const filhas = Object.values(mapping).filter((v) => v === s.slug).length;
    console.log(`  ${s.slug.padEnd(20)} ${s.nome.padEnd(20)} (${filhas} sub-categorias) ícone=${s.icone}`);
  }

  console.log(`\nTotal: ${Object.keys(mapping).length} categorias Olist mapeadas`);
  console.log('\nPróximo: npm run enrich-produtos');
})().catch((err) => {
  console.error('\nFALHA:', err.message);
  process.exit(1);
});
