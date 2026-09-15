/**
 * POST /api/frete/cotar
 *
 * Corpo: { "cep": "01001-000", "itens": [{ "sku": "LDS789...", "qtd": 2 }] }
 *
 * Devolve as modalidades de entrega para aquele CEP: retirada na loja, entrega
 * própria quando o CEP é de Curitiba ou região, e as transportadoras cotadas
 * no Melhor Envio.
 *
 * Endpoint público, sem sessão - é o que o visitante usa antes de comprar. Por
 * isso o carrinho chega só como SKU e quantidade: preço, peso e medidas são
 * lidos do catálogo no servidor, nunca aceitos do navegador.
 */

const { cotar, atendeEntregaLocal, ErroFrete } = require('../_frete.js');

/* Regras da entrega da própria loja. Espelham o que o checkout já prometia:
   "1 a 3 dias úteis · grátis acima de R$ 299". */
const FRETE_GRATIS_ACIMA = Number(process.env.FRETE_GRATIS_ACIMA || 299);
const FRETE_LOCAL = Number(process.env.FRETE_LOCAL || 24.9);

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
    const r = await cotar(corpo.cep, itens);

    const opcoes = [
      {
        id: 'retirada',
        tipo: 'retirada',
        transportadora: 'VM Click',
        servico: 'Retirar na loja - Portão',
        preco: 0,
        prazo: null,
        detalhe: 'R. Amadeu do Amaral, 1602 · pronto em 2 horas',
      },
    ];

    if (r.local) {
      const subtotal = corpo.subtotal;
      /* O subtotal do navegador serve só para o aviso de frete grátis, que é
         promoção da própria loja - não define preço de transportadora. */
      const gratis = Number(subtotal) >= FRETE_GRATIS_ACIMA;
      opcoes.push({
        id: 'entrega-local',
        tipo: 'local',
        transportadora: 'VM Click',
        servico: 'Entrega VM Click - Curitiba e região',
        preco: gratis ? 0 : FRETE_LOCAL,
        prazo: 3,
        detalhe: gratis ? 'Frete grátis nesta compra' : `Grátis acima de R$ ${FRETE_GRATIS_ACIMA}`,
      });
    }

    for (const o of r.opcoes) {
      opcoes.push({
        id: `me-${o.id}`,
        tipo: 'transportadora',
        transportadora: o.transportadora,
        servico: o.servico,
        preco: o.preco,
        prazo: o.prazo,
        detalhe: o.prazo ? `${o.prazo} dia(s) útil(eis) após a postagem` : '',
      });
    }

    /* Cache curto: o mesmo CEP costuma ser cotado várias vezes seguidas
       enquanto a pessoa mexe no carrinho, e a cotação não muda nesse intervalo. */
    res.setHeader('Cache-Control', 'private, max-age=300');

    return res.status(200).json({
      opcoes,
      excedeLimite: r.excedeLimite,
      pesoEstimado: r.estimado,
    });
  } catch (e) {
    if (e instanceof ErroFrete) return res.status(e.status).json({ erro: e.message });
    console.error('[frete] falha inesperada:', e);
    return res.status(500).json({ erro: 'Não foi possível calcular o frete agora' });
  }
};
