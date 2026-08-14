#!/usr/bin/env node
/**
 * VM Click - Deriva a marca dos produtos a partir do nome e regenera data/marcas.js
 *
 * Uso:
 *   npm run derivar-marcas          # aplica em data/produtos.js e data/marcas.js
 *   npm run derivar-marcas:dry      # só relatório, não escreve nada
 *
 * Por que existe: o catálogo vindo do Olist chega com `marca` vazia (o campo
 * não é preenchido no ERP), o que deixava a esteira da home sem nenhuma marca
 * e o filtro de marca da vitrine inútil. As regras vivem em regras-marcas.js.
 *
 * Este script NÃO bate na API. Ele reescreve, in-place e de forma idempotente:
 *   - o campo `marca` de cada produto em data/produtos.js (só quando vazio)
 *   - a entrada "Marca" em `specs` (aparece na ficha técnica da PDP)
 *   - data/marcas.js inteiro (top N por contagem real de produtos)
 *
 * O mesmo fallback roda dentro de enrich-produtos.js, então um sync novo
 * já nasce com marca preenchida sem precisar rodar isto de novo.
 */

const fs = require('fs');
const path = require('path');
const { detectarMarca } = require('./regras-marcas.js');

const ROOT = path.resolve(__dirname, '..');
const PRODUTOS_PATH = path.join(ROOT, 'data', 'produtos.js');
const MARCAS_PATH = path.join(ROOT, 'data', 'marcas.js');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
/* --force re-deriva também os produtos que já têm marca. Use depois de mexer
   nas regras; sem ele, o que já está preenchido é preservado. */
const FORCE = args.includes('--force');
const TOP = 20;

/* Paleta da esteira de marcas — mesma lista usada por enrich-produtos.js. */
const CORES_MARCA = [
  '#0B4DA2', '#2E9E45', '#C8102E', '#0066B3', '#D62027', '#E2661A', '#B07A00', '#D50032',
  '#007D8A', '#2B2B2B', '#E06A00', '#0067B1', '#1B7F3B', '#B3261E', '#1F4E79', '#C2410C',
];

/* Um objeto de produto no arquivo gerado começa em `{` e fecha em `\n  }`. */
const BLOCO_PRODUTO = /\{\s*\n?\s*sku:[\s\S]*?\n  \}/g;
const CAMPO_NOME_MARCA = /nome: ("(?:[^"\\]|\\.)*"), marca: ("(?:[^"\\]|\\.)*")/;
const CAMPO_SPECS = /specs: \{/;

function main() {
  if (!fs.existsSync(PRODUTOS_PATH)) {
    console.error('✖ data/produtos.js não encontrado. Rode `npm run enrich-produtos` antes.');
    process.exit(1);
  }

  const original = fs.readFileSync(PRODUTOS_PATH, 'utf8');
  const contagem = new Map();
  let preenchidos = 0;
  let jaTinham = 0;
  let semMarca = 0;
  let total = 0;

  const atualizado = original.replace(BLOCO_PRODUTO, (bloco) => {
    const campos = bloco.match(CAMPO_NOME_MARCA);
    if (!campos) return bloco;
    total++;

    const nome = JSON.parse(campos[1]);
    const marcaAtual = JSON.parse(campos[2]);

    /* Marca vinda do ERP tem precedência absoluta. */
    if (marcaAtual && !FORCE) {
      jaTinham++;
      contagem.set(marcaAtual, (contagem.get(marcaAtual) || 0) + 1);
      return bloco;
    }

    const marca = detectarMarca(nome);
    if (!marca) {
      semMarca++;
      /* Em --force, uma regra removida/ajustada precisa limpar o valor antigo. */
      if (!marcaAtual) return bloco;
      return bloco
        .replace(CAMPO_NOME_MARCA, `nome: ${campos[1]}, marca: ""`)
        .replace(/"Marca": "(?:[^"\\]|\\.)*",? ?/, '')
        .replace(/specs: \{ \}/, 'specs: {}');
    }

    preenchidos++;
    contagem.set(marca, (contagem.get(marca) || 0) + 1);

    let novo = bloco.replace(CAMPO_NOME_MARCA, `nome: ${campos[1]}, marca: ${JSON.stringify(marca)}`);

    /* Espelha na ficha técnica da PDP: atualiza se já existir, insere se não. */
    if (/specs: \{[^}]*"Marca":/.test(novo)) {
      novo = novo.replace(/("Marca": )"(?:[^"\\]|\\.)*"/, `$1${JSON.stringify(marca)}`);
    } else {
      novo = novo.replace(CAMPO_SPECS, `specs: { "Marca": ${JSON.stringify(marca)},`)
                 .replace(/specs: \{ "Marca": ("(?:[^"\\]|\\.)*"), \}/, 'specs: { "Marca": $1 }');
    }
    return novo;
  });

  const marcas = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, TOP)
    .map(([n, qtd], i) => ({ n, c: CORES_MARCA[i % CORES_MARCA.length], qtd }));

  console.log(`  produtos analisados : ${total}`);
  console.log(`  marca já preenchida : ${jaTinham}`);
  console.log(`  marca derivada      : ${preenchidos}`);
  console.log(`  sem marca           : ${semMarca}`);
  console.log(`  marcas distintas    : ${contagem.size} (publicando top ${marcas.length})`);
  console.log('');
  marcas.forEach((m, i) => console.log(`  ${String(i + 1).padStart(2)}. ${m.n} — ${m.qtd} produtos`));

  if (DRY_RUN) {
    console.log('\n  (--dry-run: nada foi escrito)');
    return;
  }

  fs.writeFileSync(PRODUTOS_PATH, atualizado, 'utf8');
  console.log(`\n  ✓ ${path.relative(ROOT, PRODUTOS_PATH)} atualizado`);

  const header = `/* Gerado por scripts/derivar-marcas.js — top ${marcas.length} marcas do catálogo.\n` +
    `   Contagem real de produtos por marca; a cor alimenta a esteira da home. */\n\n`;
  const body = `window.VM_MARCAS = [\n${marcas
    .map((m) => `  { n: ${JSON.stringify(m.n)}, c: ${JSON.stringify(m.c)}, qtd: ${m.qtd} }`)
    .join(',\n')}\n];\n`;
  fs.writeFileSync(MARCAS_PATH, header + body, 'utf8');
  console.log(`  ✓ ${path.relative(ROOT, MARCAS_PATH)} atualizado (${marcas.length} marcas)`);
}

main();
