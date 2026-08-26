/**
 * VM Click - montagem dos arquivos de conteúdo do site
 *
 * O painel manda o que o operador escolheu; aqui os arquivos que o site lê são
 * montados por inteiro, prontos para gravar no repositório.
 *
 * As regras de marca e de categoria são as mesmas usadas pelo sync de linha de
 * comando (scripts/regras-*.js), para painel e terminal produzirem o mesmo
 * resultado.
 */

const { canonizarMarca, detectarMarca } = require('../scripts/regras-marcas.js');
const REGRAS_CATEGORIA = require('../scripts/regras-catalogo.js');

/* ------------------------------------------------------------- utilitários */

function slugify(t) {
  return String(t || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function numero(v, padrao = 0) {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return Number.isFinite(n) ? n : padrao;
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\s*\/\s*(p|div|li|ul|ol|tr|td|h[1-6]|section)\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ------------------------------------------- descrição vinda do marketplace */

const CORTES_RUIDO = [
  /_{4,}/,
  /\bPor que comprar\b/i,
  /\bPerguntas?\s+Frequentes\b/i,
  /\bAgradecemos pela confian/i,
  /\bCompre com seguran/i,
];

const ROTULO_SPEC = /([A-ZÀ-ÝÁÉÍÓÚÂÊÔÃÕÇ][a-zà-ÿáéíóúâêôãõç]+(?:\s+(?:de|da|do|d[ae]s)?\s*[a-zà-ÿáéíóúâêôãõç]+){0,3})\s*:\s*/g;

/** Separa prosa do produto, ficha técnica e ruído de anúncio. */
function separarDescricao(texto) {
  const limpo = stripHtml(texto);
  if (!limpo) return { descricao: '', specs: {} };

  let corte = limpo.length;
  for (const re of CORTES_RUIDO) {
    const m = limpo.match(re);
    if (m && m.index < corte) corte = m.index;
  }
  const util = limpo.slice(0, corte).trim();

  const marcas = [];
  let m;
  ROTULO_SPEC.lastIndex = 0;
  while ((m = ROTULO_SPEC.exec(util)) !== null) {
    marcas.push({ rotulo: m[1].trim(), ini: m.index, fim: m.index + m[0].length });
  }
  if (marcas.length < 2) return { descricao: util, specs: {} };

  const specs = {};
  marcas.forEach((a, i) => {
    const fim = i + 1 < marcas.length ? marcas[i + 1].ini : util.length;
    const valor = util.slice(a.fim, fim).trim().replace(/[.;,]+$/, '');
    if (valor && valor.length <= 60 && a.rotulo.toLowerCase() !== 'marca') specs[a.rotulo] = valor;
  });

  return { descricao: util.slice(0, marcas[0].ini).trim(), specs };
}

/* -------------------------------------------------------------- categoria */

function detectarCategoria(nome) {
  for (const r of REGRAS_CATEGORIA) {
    if (r.match.test(nome)) return r;
  }
  return null;
}

const CATEGORIA_PADRAO = {
  slug: 'eletrica', nome: 'Elétrica', curto: 'Elétrica', icone: 'p-disjuntor',
  desc: 'Produtos da categoria Elétrica disponíveis em estoque.',
};

/* ------------------------------------------------ produto do Olist -> site */

/** Converte o detalhe cru do Olist no formato que o site consome. */
function mapearProduto(d) {
  const nome = d.descricao || '';
  const dim = d.dimensoes || {};
  const anexos = Array.isArray(d.anexos) ? d.anexos : [];
  const precos = d.precos || {};

  const preco = numero(precos.preco, 0);
  const promo = numero(precos.precoPromocional, 0);
  const marca = canonizarMarca((d.marca && d.marca.nome) || detectarMarca(nome));
  const cat = detectarCategoria(nome) || CATEGORIA_PADRAO;
  const separado = separarDescricao(d.descricaoComplementar || '');

  /* ficha técnica extraída do texto primeiro; campos fiscais depois */
  const specs = Object.assign({}, separado.specs);
  if (marca) specs['Marca'] = marca;
  if (d.gtin) specs['GTIN'] = String(d.gtin);
  if (d.ncm) specs['NCM'] = String(d.ncm);
  if (numero(dim.largura)) specs['Largura'] = `${numero(dim.largura)} cm`;
  if (numero(dim.altura)) specs['Altura'] = `${numero(dim.altura)} cm`;
  if (numero(dim.comprimento)) specs['Comprimento'] = `${numero(dim.comprimento)} cm`;
  if (numero(dim.pesoLiquido)) specs['Peso líquido'] = `${numero(dim.pesoLiquido)} kg`;
  if (numero(dim.pesoBruto)) specs['Peso bruto'] = `${numero(dim.pesoBruto)} kg`;
  if (d.garantia) specs['Garantia'] = d.garantia;

  return {
    sku: d.sku || String(d.id),
    slug: slugify(nome) || slugify(d.sku || String(d.id)),
    cat: cat.slug,
    nome,
    marca,
    preco: promo > 0 && promo < preco ? promo : preco,
    precoDe: promo > 0 && promo < preco ? preco : null,
    estoque: Math.max(0, parseInt((d.estoque && d.estoque.quantidade) || 0, 10) || 0),
    icone: cat.icone,
    imagens: anexos.map((a) => a && a.url).filter(Boolean),
    novo: false,
    destaque: false,
    nota: 0,
    avaliacoes: 0,
    unidade: d.unidade || 'un',
    desc: separado.descricao,
    specs,
  };
}

/* ------------------------------------------------------ geração dos textos */

function agora() {
  return new Date().toISOString();
}

function textoProduto(p) {
  const imagens = p.imagens.length ? `[${p.imagens.map((u) => JSON.stringify(u)).join(',')}]` : '[]';
  return `  {
    sku: ${JSON.stringify(p.sku)}, slug: ${JSON.stringify(p.slug)}, cat: ${JSON.stringify(p.cat)},
    nome: ${JSON.stringify(p.nome)}, marca: ${JSON.stringify(p.marca)},
    preco: ${p.preco.toFixed(2)}, precoDe: ${p.precoDe == null ? 'null' : p.precoDe.toFixed(2)}, estoque: ${p.estoque}, icone: ${JSON.stringify(p.icone)},
    imagens: ${imagens},
    novo: ${p.novo}, destaque: ${p.destaque}, nota: ${p.nota}, avaliacoes: ${p.avaliacoes}, unidade: ${JSON.stringify(p.unidade)},
    desc: ${JSON.stringify(p.desc)},
    specs: ${JSON.stringify(p.specs)}
  }`;
}

/** data/produtos.js completo, com o bloco de categorias que têm produto. */
function gerarProdutosJs(produtos) {
  const ordenados = produtos.slice().sort((a, b) => {
    const estoque = (b.estoque > 0) - (a.estoque > 0);
    if (estoque) return estoque;
    const img = (b.imagens.length > 0) - (a.imagens.length > 0);
    if (img) return img;
    return (a.nome || '').localeCompare(b.nome || '');
  });

  const usadas = new Set(ordenados.map((p) => p.cat));
  const cats = [CATEGORIA_PADRAO].concat(REGRAS_CATEGORIA)
    .filter((c) => usadas.has(c.slug))
    .filter((c, i, arr) => arr.findIndex((x) => x.slug === c.slug) === i)
    .map((c) => `  {
    slug: ${JSON.stringify(c.slug)},
    nome: ${JSON.stringify(c.nome)},
    curto: ${JSON.stringify(c.curto)},
    icone: ${JSON.stringify(c.icone)},
    desc: ${JSON.stringify(c.desc)}
  }`);

  return `/* ==========================================================================
   VM Click - catálogo do site
   --------------------------------------------------------------------------
   GERADO PELO PAINEL ADMINISTRATIVO - NÃO EDITE À MÃO.
   Publicado em: ${agora()}
   Total de produtos: ${ordenados.length}
   Fonte: Olist ERP (API v3). O cadastro continua sendo feito lá.
   ========================================================================== */

window.VM_CATEGORIAS = [
${cats.join(',\n')}
];

window.VM_PRODUTOS = [
${ordenados.map(textoProduto).join(',\n')}
];
`;
}

function gerarMarcasJs(produtos, topN = 20) {
  const CORES = ['#0B4DA2', '#2E9E45', '#C8102E', '#0066B3', '#D62027', '#E2661A', '#B07A00',
    '#D50032', '#007D8A', '#2B2B2B', '#E06A00', '#0067B1', '#1B7F3B', '#B3261E', '#1F4E79', '#C2410C'];
  const conta = {};
  produtos.forEach((p) => { if (p.marca) conta[p.marca] = (conta[p.marca] || 0) + 1; });

  const marcas = Object.entries(conta)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([n, qtd], i) => `  { n: ${JSON.stringify(n)}, c: ${JSON.stringify(CORES[i % CORES.length])}, qtd: ${qtd} }`);

  return `/* Marcas do catálogo. Gerado pelo painel em ${agora()}.
   A contagem vem dos produtos publicados; a cor alimenta a esteira da home. */

window.VM_MARCAS = [
${marcas.join(',\n')}
];
`;
}

function gerarCuradoriaJs(curadoria) {
  return `/* Curadoria da home. Gerado pelo painel em ${agora()}.
   destaques = vitrine "Destaques da loja"
   ofertas   = vitrine "Ofertas da semana" (precoDe é o preço anterior praticado) */

window.VM_CURADORIA = ${JSON.stringify(curadoria, null, 2)};
`;
}

function gerarBannersJs(banners) {
  return `/* Banners da home. Gerado pelo painel em ${agora()}. */

window.VM_BANNERS = ${JSON.stringify(banners, null, 2)};
`;
}

function gerarBlogJs(posts) {
  return `/* Índice do blog. Gerado pelo painel em ${agora()}.
   O conteúdo de cada artigo mora no HTML da própria página. */

window.VM_POSTS = ${JSON.stringify(posts, null, 2)};
`;
}

function gerarSkusTxt(skus) {
  return `# Produtos publicados no site. Um código por linha.
# Gerado pelo painel em ${agora()}.

${skus.join('\n')}
`;
}

module.exports = {
  mapearProduto,
  gerarProdutosJs,
  gerarMarcasJs,
  gerarCuradoriaJs,
  gerarBannersJs,
  gerarBlogJs,
  gerarSkusTxt,
  separarDescricao,
};
