/**
 * POST /api/frete/cotar
 *
 * Corpo: { "cep": "01001-000", "itens": [{ "sku": "LDS789...", "qtd": 2 }] }
 *
 * Devolve as modalidades de entrega para aquele CEP: retirada na loja, entrega
 * grátis da loja quando vale (Curitiba, a partir de R$ 500) e as
 * transportadoras cotadas no Melhor Envio.
 *
 * Endpoint público, sem sessão - é o que o visitante usa antes de comprar. Por
 * isso o carrinho chega só como SKU e quantidade: preço, peso e medidas são
 * lidos do catálogo no servidor, nunca aceitos do navegador.
 */

const { opcoesDeEntrega, ErroFrete } = require('../_frete.js');

const MAX_ITENS = 60;

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

/** Normaliza o carrinho e joga fora o que não for utilizável. */
function normalizarItens(bruto) {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((i) => ({ sku: String((i && i.sku) || '').trim(), qtd: Math.floor(Number(i && i.qtd) || 0) }))
    .filter((i) => i.sku && i.qtd > 0 && i.qtd <= 999)
    .slice(0, MAX_ITENS);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Use POST' });
  }

  const corpo = lerCorpo(req);
  const itens = normalizarItens(corpo.itens);

  if (!itens.length) return res.status(400).json({ erro: 'Carrinho vazio' });

  try {
    /* O subtotal do navegador serve só para o aviso de frete grátis da
       entrega própria, que é promoção da loja. No pedido ele é recalculado
       no servidor antes de virar cobrança. */
    const r = await opcoesDeEntrega(corpo.cep, itens, corpo.subtotal);

    /* Cache curto: o mesmo CEP costuma ser cotado várias vezes seguidas
       enquanto a pessoa mexe no carrinho, e a cotação não muda nesse intervalo. */
    res.setHeader('Cache-Control', 'private, max-age=300');

    return res.status(200).json(r);
  } catch (e) {
    if (e instanceof ErroFrete) return res.status(e.status).json({ erro: e.message });
    console.error('[frete] falha inesperada:', e);
    return res.status(500).json({ erro: 'Não foi possível calcular o frete agora' });
  }
};
