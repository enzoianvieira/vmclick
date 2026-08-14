#!/usr/bin/env node
/* ==========================================================================
   VM Click - otimização de imagens
   Lê os PNGs originais de assets/img/_originais/ e gera as versões servidas
   pelo site em assets/img/{brand,banners,loja}/.

   Depende apenas do ffmpeg no PATH (com libwebp). Sem pacotes npm.

   Uso:  node scripts/otimizar-imagens.js [--force]
   Sem --force, pula arquivos de saída que já existem e estão atualizados.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const ORIG = path.join(RAIZ, 'assets', 'img', '_originais');
const IMG = path.join(RAIZ, 'assets', 'img');
const FORCE = process.argv.includes('--force');

/* --------------------------------------------------------------------------
   Plano de saída
   -------------------------------------------------------------------------- */

/* Logos e favicon: PNG, alfa preservado (aparecem sobre fundo claro e escuro). */
const MARCA = [
  { de: 'logo1.png', para: 'brand/logo-lockup.png',      largura: 760 },
  { de: 'logo3.png', para: 'brand/logo-lockup-dark.png', largura: 760 },
  { de: 'logo2.png', para: 'brand/logo-mark.png',        largura: 512 },
  { de: 'logo2.png', para: 'brand/favicon-192.png',      largura: 192 },
  { de: 'logo2.png', para: 'brand/favicon-180.png',      largura: 180 },
  { de: 'logo2.png', para: 'brand/favicon-32.png',       largura: 32  }
];

/* Banners promocionais: par desktop (1920x600) + mobile (800x600).
   Qualidade mais alta porque têm tipografia grande e fina. */
const BANNERS = [
  { slug: 'promo-iluminacao', desktop: 'banner_desktop1.png', mobile: 'banner_mobile1.png' },
  { slug: 'promo-hidraulica', desktop: 'banner_desktop2.png', mobile: 'banner_mobile2.png' },
  { slug: 'promo-ferramentas', desktop: 'banner_desktop3.png', mobile: 'banner_mobile3.png' }
];

/* Fotos da loja: duas larguras para srcset. */
const FOTOS = [
  { de: 'fachada.png',  slug: 'fachada'  },
  { de: 'interior.png', slug: 'interior' },
  { de: 'painel.png',   slug: 'painel'   }
];

const LARGURAS_FOTO = [1600, 900];

/* --------------------------------------------------------------------------
   Execução
   -------------------------------------------------------------------------- */

let gerados = 0;
let pulados = 0;
let bytesEntrada = 0;
let bytesSaida = 0;

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y'].concat(args), {
    stdio: ['ignore', 'ignore', 'pipe']
  });
}

function precisa(entrada, saida) {
  if (FORCE) return true;
  if (!fs.existsSync(saida)) return true;
  return fs.statSync(entrada).mtimeMs > fs.statSync(saida).mtimeMs;
}

function garanteDir(arquivo) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
}

function kb(bytes) { return (bytes / 1024).toFixed(0) + ' KB'; }

function registra(entrada, saida) {
  const tam = fs.statSync(saida).size;
  bytesSaida += tam;
  console.log('  ✓ ' + path.relative(IMG, saida).replace(/\\/g, '/').padEnd(44) + kb(tam));
}

/* scale=largura:-2 mantém a proporção e força altura par (exigência do yuv420p
   do JPEG). Para PNG/WebP com alfa a paridade é inofensiva. */
function escala(largura) { return 'scale=' + largura + ':-2:flags=lanczos'; }

function png(entrada, saida, largura) {
  if (!precisa(entrada, saida)) { pulados++; return; }
  garanteDir(saida);
  ffmpeg(['-i', entrada, '-vf', escala(largura), saida]);
  gerados++;
  registra(entrada, saida);
}

function webp(entrada, saida, largura, qualidade) {
  if (!precisa(entrada, saida)) { pulados++; return; }
  garanteDir(saida);
  ffmpeg([
    '-i', entrada, '-vf', escala(largura),
    '-c:v', 'libwebp', '-quality', String(qualidade), '-compression_level', '6',
    saida
  ]);
  gerados++;
  registra(entrada, saida);
}

function jpg(entrada, saida, largura, q) {
  if (!precisa(entrada, saida)) { pulados++; return; }
  garanteDir(saida);
  /* Fotos com alfa: achata sobre branco antes de virar JPEG. */
  const filtro = 'color=white,format=rgb24[bg];[bg][0:v]scale2ref[bg2][v];' +
                 '[bg2][v]overlay=shortest=1,' + escala(largura);
  ffmpeg(['-i', entrada, '-filter_complex', filtro, '-q:v', String(q), saida]);
  gerados++;
  registra(entrada, saida);
}

function main() {
  if (!fs.existsSync(ORIG)) {
    console.error('Pasta de originais não encontrada: ' + ORIG);
    console.error('Coloque os PNGs originais lá e rode de novo.');
    process.exit(1);
  }

  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  } catch (e) {
    console.error('ffmpeg não encontrado no PATH. Instale o ffmpeg (com libwebp) e rode de novo.');
    process.exit(1);
  }

  fs.readdirSync(ORIG).forEach(function (f) {
    if (f.endsWith('.png')) bytesEntrada += fs.statSync(path.join(ORIG, f)).size;
  });

  console.log('\nMarca');
  MARCA.forEach(function (m) {
    png(path.join(ORIG, m.de), path.join(IMG, m.para), m.largura);
  });

  console.log('\nBanners');
  BANNERS.forEach(function (b) {
    const d = path.join(ORIG, b.desktop);
    const m = path.join(ORIG, b.mobile);
    webp(d, path.join(IMG, 'banners', b.slug + '-1920.webp'), 1920, 88);
    jpg(d, path.join(IMG, 'banners', b.slug + '-1920.jpg'), 1920, 3);
    webp(m, path.join(IMG, 'banners', b.slug + '-800.webp'), 800, 88);
    jpg(m, path.join(IMG, 'banners', b.slug + '-800.jpg'), 800, 3);
  });

  console.log('\nFotos da loja');
  FOTOS.forEach(function (f) {
    const entrada = path.join(ORIG, f.de);
    LARGURAS_FOTO.forEach(function (w) {
      webp(entrada, path.join(IMG, 'loja', f.slug + '-' + w + '.webp'), w, 82);
      jpg(entrada, path.join(IMG, 'loja', f.slug + '-' + w + '.jpg'), w, 4);
    });
  });

  console.log('\n' + gerados + ' arquivo(s) gerado(s), ' + pulados + ' já atualizado(s).');
  if (gerados) {
    console.log('Originais: ' + kb(bytesEntrada) + '  →  gerados nesta rodada: ' + kb(bytesSaida));
  }
}

main();
