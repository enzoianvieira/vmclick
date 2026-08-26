/**
 * POST /api/publicar
 *
 * Publica o que foi editado no painel. O operador clica em um botão; aqui os
 * arquivos são montados e gravados no repositório, e a Vercel reconstrói o
 * site sozinha. Nenhum download, nenhum comando de terminal.
 *
 * Corpo:
 *   { tipo: 'produtos', skus: [...], destaques: [...], ofertas: [...] }
 *   { tipo: 'banners',  banners: [...] }
 *   { tipo: 'blog',     posts: [...] }
 *
 * GET /api/publicar  -> diz se a publicação automática está configurada
 */

const { olistGet } = require('./_olist.js');
const { protegido } = require('./_sessao.js');
const gh = require('./_github.js');
const cat = require('./_catalogo.js');

/* teto de itens por publicação: evita estourar o tempo da função quando a
   lista curada crescer demais sem ninguém perceber */
const MAX_PRODUTOS = 120;

async function publicarProdutos(dados) {
  const skus = Array.from(new Set((dados.skus || []).map((s) => String(s).trim()).filter(Boolean)));
  if (!skus.length) throw new gh.ErroGitHub(400, 'Nenhum produto selecionado.');
  if (skus.length > MAX_PRODUTOS) {
    throw new gh.ErroGitHub(400, `São ${skus.length} produtos. O limite por publicação é ${MAX_PRODUTOS}.`);
  }

  /* Busca o detalhe de cada SKU no Olist. É isto que dispensa o antigo
     `npm run sync-site`: o painel publica com preço, estoque, foto e ficha
     técnica já atualizados. */
  const produtos = [];
  const falharam = [];

  for (const sku of skus) {
    try {
      const lista = await olistGet(`/produtos?limit=1&codigo=${encodeURIComponent(sku)}`);
      const achado = ((lista && lista.itens) || [])[0];
      if (!achado || !achado.id) { falharam.push(sku); continue; }

      const detalhe = await olistGet(`/produtos/${achado.id}`);
      produtos.push(cat.mapearProduto(detalhe));
    } catch (e) {
      falharam.push(sku);
    }
  }

  if (!produtos.length) {
    throw new gh.ErroGitHub(502, 'Não consegui trazer nenhum produto do Olist. Tente de novo em instantes.');
  }

  /* aplica a curadoria sobre o que veio do ERP */
  const destaques = new Set(dados.destaques || []);
  const ofertas = new Map((dados.ofertas || []).map((o) => [o.sku, Number(o.precoDe)]));

  produtos.forEach((p) => {
    if (destaques.has(p.sku)) p.destaque = true;
    const de = ofertas.get(p.sku);
    /* preço "de" só entra se for maior que o preço atual: desconto que não
       existiu é propaganda enganosa (CDC art. 37) */
    if (de && de > p.preco) p.precoDe = de;
  });

  const gravados = [];
  gravados.push(await gh.gravar('data/produtos.js', cat.gerarProdutosJs(produtos),
    `conteudo: publica ${produtos.length} produtos pelo painel`));
  gravados.push(await gh.gravar('data/marcas.js', cat.gerarMarcasJs(produtos),
    'conteudo: atualiza marcas derivadas do catalogo'));
  gravados.push(await gh.gravar('scripts/skus-site.txt', cat.gerarSkusTxt(skus),
    'conteudo: atualiza a lista curada de SKUs'));
  gravados.push(await gh.gravar('data/curadoria.js', cat.gerarCuradoriaJs({
    destaques: dados.destaques || [],
    ofertas: dados.ofertas || [],
  }), 'conteudo: atualiza destaques e ofertas da home'));

  return {
    publicados: produtos.length,
    naoEncontrados: falharam,
    arquivos: gravados.map((g) => g.caminho),
  };
}

async function publicarBanners(dados) {
  const banners = dados.banners || [];
  const invalido = banners.find((b) => !b.titulo || !b.link || !b.img || !b.alt);
  if (invalido) throw new gh.ErroGitHub(400, `O banner "${invalido.titulo || 'sem título'}" está incompleto.`);

  const g = await gh.gravar('data/banners.js', cat.gerarBannersJs(banners),
    `conteudo: atualiza ${banners.length} banners da home`);
  return { publicados: banners.length, arquivos: [g.caminho] };
}

async function publicarBlog(dados) {
  const posts = dados.posts || [];
  const invalido = posts.find((p) => !p.titulo || !p.slug);
  if (invalido) throw new gh.ErroGitHub(400, 'Há artigo sem título ou sem arquivo definido.');

  const g = await gh.gravar('data/blog.js', cat.gerarBlogJs(posts),
    `conteudo: atualiza indice do blog (${posts.length} artigos)`);
  return { publicados: posts.length, arquivos: [g.caminho] };
}

module.exports = protegido(async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({ configurado: gh.disponivel() });
  }
  if (req.method !== 'POST') return res.status(405).json({ erro: 'método não suportado' });

  const dados = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  try {
    let r;
    if (dados.tipo === 'produtos') r = await publicarProdutos(dados);
    else if (dados.tipo === 'banners') r = await publicarBanners(dados);
    else if (dados.tipo === 'blog') r = await publicarBlog(dados);
    else return res.status(400).json({ erro: 'Tipo de publicação desconhecido.' });

    return res.status(200).json(Object.assign({ ok: true }, r));
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ erro: err.message });
  }
});
