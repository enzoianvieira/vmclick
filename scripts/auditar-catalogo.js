#!/usr/bin/env node
/**
 * VM Click - auditoria do catálogo que vai para o site
 *
 * Por que existe: os dados que vêm do Olist foram cadastrados pensando em
 * marketplace, não em loja própria. Alguns problemas são cosméticos, mas
 * outros quebram a venda de verdade - peso errado destrói o cálculo de frete
 * e o cliente abandona o carrinho na hora da cotação.
 *
 * Este script NÃO altera nada. Só lê data/produtos.js e aponta o que precisa
 * ser corrigido no cadastro do Olist, que é a fonte de verdade.
 *
 * Uso:
 *   node scripts/auditar-catalogo.js
 *   node scripts/auditar-catalogo.js --csv > auditoria.csv
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV = process.argv.includes('--csv');

/* ---------------------------------------------------------------- severidade
   bloqueia = impede vender direito (frete errado, produto sem preço)
   atrapalha = prejudica conversão (sem foto, sem descrição)
   ajuste = qualidade de dado, não impede a venda                            */
const BLOQUEIA = 'bloqueia';
const ATRAPALHA = 'atrapalha';
const AJUSTE = 'ajuste';

function num(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Valida o dígito verificador de um GTIN/EAN de 8, 12, 13 ou 14 dígitos. */
function gtinValido(gtin) {
  const d = String(gtin || '').replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const digitos = d.split('').map(Number);
  const verificador = digitos.pop();
  let soma = 0;
  digitos.reverse().forEach((n, i) => { soma += n * (i % 2 === 0 ? 3 : 1); });
  return (10 - (soma % 10)) % 10 === verificador;
}

const RUIDO_MARKETPLACE = /Perguntas?\s+Frequentes|Mercado\s+Envios|Por que comprar|Agradecemos pela confian|Compre com seguran/i;

function auditar(p) {
  const achados = [];
  const s = p.specs || {};
  const pesoLiq = num(s['Peso líquido']);
  const pesoBru = num(s['Peso bruto']);
  const larg = num(s['Largura']);
  const alt = num(s['Altura']);
  const comp = num(s['Comprimento']);

  /* --- frete: o que mais dói se estiver errado --- */
  if (pesoLiq == null && pesoBru == null) {
    achados.push([BLOQUEIA, 'Sem peso cadastrado: o frete não tem como ser calculado']);
  } else {
    const peso = pesoBru != null ? pesoBru : pesoLiq;
    if (peso === 0) {
      achados.push([BLOQUEIA, 'Peso zerado: frete sai errado']);
    } else if (peso > 30) {
      achados.push([BLOQUEIA,
        `Peso de ${peso} kg parece grama cadastrada como quilo (seriam ${peso} g). Frete sairia absurdo`]);
    }
    if (pesoLiq != null && pesoBru != null && pesoBru < pesoLiq) {
      achados.push([AJUSTE, `Peso bruto (${pesoBru}) menor que o líquido (${pesoLiq})`]);
    }
  }

  if (larg == null || alt == null || comp == null || !larg || !alt || !comp) {
    achados.push([BLOQUEIA, 'Dimensões incompletas: transportadora cobra por cubagem']);
  }

  /* --- comercial --- */
  if (!p.preco || p.preco <= 0) achados.push([BLOQUEIA, 'Sem preço de venda']);
  if (p.precoDe && p.precoDe <= p.preco) {
    achados.push([BLOQUEIA, 'Preço "de" menor ou igual ao preço atual: propaganda enganosa (CDC art. 37)']);
  }

  /* --- conversão --- */
  if (!p.imagens || !p.imagens.length) achados.push([ATRAPALHA, 'Sem foto do produto']);
  if (!(p.desc || '').trim()) achados.push([ATRAPALHA, 'Sem descrição']);
  else if (RUIDO_MARKETPLACE.test(p.desc)) {
    achados.push([AJUSTE, 'Descrição contém FAQ/propaganda de marketplace (o site já filtra, mas convém limpar na origem)']);
  }

  /* --- qualidade de dado --- */
  if (!p.marca) achados.push([ATRAPALHA, 'Sem marca: some do filtro da vitrine']);
  if (!s['NCM']) achados.push([AJUSTE, 'Sem NCM: necessário para emitir NF-e']);
  if (s['GTIN'] && !gtinValido(s['GTIN'])) {
    achados.push([AJUSTE, `GTIN ${s['GTIN']} com dígito verificador inválido`]);
  }
  if ((p.nome || '') === (p.nome || '').toUpperCase() && (p.nome || '').length > 20) {
    achados.push([AJUSTE, 'Nome todo em caixa alta: dificulta a leitura na vitrine']);
  }

  return achados;
}

/* ------------------------------------------------------------------ relatório */
global.window = {};
require(path.join(ROOT, 'data', 'produtos.js'));
const produtos = global.window.VM_PRODUTOS || [];

const linhas = [];
produtos.forEach((p) => {
  auditar(p).forEach(([sev, msg]) => linhas.push({ sev, sku: p.sku, nome: p.nome, msg }));
});

if (CSV) {
  console.log('severidade,sku,produto,problema');
  linhas.forEach((l) => {
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    console.log([l.sev, esc(l.sku), esc(l.nome), esc(l.msg)].join(','));
  });
  process.exit(0);
}

const porSev = { [BLOQUEIA]: [], [ATRAPALHA]: [], [AJUSTE]: [] };
linhas.forEach((l) => porSev[l.sev].push(l));

const ROTULO = {
  [BLOQUEIA]: 'BLOQUEIA A VENDA',
  [ATRAPALHA]: 'ATRAPALHA A CONVERSÃO',
  [AJUSTE]: 'AJUSTE DE QUALIDADE'
};

console.log('');
console.log('VM Click - auditoria do catálogo do site');
console.log('='.repeat(72));
console.log(`Produtos analisados: ${produtos.length}`);
console.log(`Problemas encontrados: ${linhas.length}`);
console.log('Nada é alterado por este script. Correções são feitas no Olist.');

[BLOQUEIA, ATRAPALHA, AJUSTE].forEach((sev) => {
  const itens = porSev[sev];
  console.log('');
  console.log(`${ROTULO[sev]} (${itens.length})`);
  console.log('-'.repeat(72));
  if (!itens.length) { console.log('  nenhum'); return; }

  /* agrupa por problema: quando 15 produtos têm a mesma falha, o que importa
     é a falha, não repetir 15 linhas quase iguais */
  const grupos = {};
  itens.forEach((l) => { (grupos[l.msg] = grupos[l.msg] || []).push(l.sku); });
  Object.entries(grupos)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([msg, skus]) => {
      console.log(`  ${skus.length}x  ${msg}`);
      console.log(`       ${skus.slice(0, 6).join(', ')}${skus.length > 6 ? ` e mais ${skus.length - 6}` : ''}`);
    });
});

const semProblema = produtos.filter((p) => !auditar(p).length);
console.log('');
console.log(`Produtos prontos para venda, sem nenhuma pendência: ${semProblema.length} de ${produtos.length}`);
console.log('');
