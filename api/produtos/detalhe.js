/**
 * GET /api/produtos/detalhe?id=123
 *
 * Traz o produto completo do Olist: marca, dimensões, peso, imagens e
 * descrição. É o que o painel mostra antes de confirmar a inclusão no site,
 * e é onde dá para ver na hora se o cadastro tem peso e medida — sem isso o
 * frete não fecha.
 */

const { olistGet, ErroOlist } = require('../_olist.js');
const { protegido } = require('../_sessao.js');

module.exports = protegido(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^\d+$/.test(id)) return res.status(400).json({ erro: 'informe o id numérico do produto' });

  try {
    const d = await olistGet(`/produtos/${id}`);
    const dim = d.dimensoes || {};
    const anexos = Array.isArray(d.anexos) ? d.anexos : [];

    const pesoBruto = Number(dim.pesoBruto) || 0;
    const temMedidas = Boolean(Number(dim.largura) && Number(dim.altura) && Number(dim.comprimento));

    return res.status(200).json({
      id: d.id,
      sku: d.sku || '',
      nome: d.descricao || '',
      marca: (d.marca && d.marca.nome) || '',
      preco: (d.precos && d.precos.preco) || 0,
      estoque: (d.estoque && d.estoque.quantidade) || 0,
      imagens: anexos.map((a) => a && a.url).filter(Boolean),
      dimensoes: {
        largura: Number(dim.largura) || 0,
        altura: Number(dim.altura) || 0,
        comprimento: Number(dim.comprimento) || 0,
        pesoBruto,
      },
      /* o painel usa isto para avisar antes de publicar um item que não
         consegue ter frete calculado */
      prontoParaFrete: Boolean(pesoBruto) && temMedidas,
    });
  } catch (err) {
    const status = err instanceof ErroOlist ? err.status : 500;
    return res.status(status).json({ erro: err.message });
  }
});
