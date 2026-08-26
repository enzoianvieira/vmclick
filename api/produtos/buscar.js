/**
 * GET /api/produtos/buscar?q=termo&pagina=0
 *
 * Procura produtos no Olist para o painel escolher quais vão ao site.
 * Só devolve o que o painel precisa mostrar: código, nome, preço e situação.
 * Exige sessão: catálogo e preço de custo não são informação pública.
 */

const { olistGet, ErroOlist } = require('../_olist.js');
const { protegido } = require('../_sessao.js');

const POR_PAGINA = 40;

/** tira acento e caixa, para comparar nome do jeito que a pessoa digitou */
function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function mapear(itens) {
  return itens.map((p) => ({
    id: p.id,
    sku: p.sku || '',
    nome: p.descricao || '',
    preco: (p.precos && p.precos.preco) || 0,
    unidade: p.unidade || 'un',
  }));
}

async function listar(params) {
  const json = await olistGet(`/produtos?${params.toString()}`);
  return {
    itens: (json && json.itens) || [],
    total: ((json && json.paginacao) || {}).total ?? 0,
  };
}

module.exports = protegido(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  const q = (url.searchParams.get('q') || '').trim();
  const pagina = Math.max(0, parseInt(url.searchParams.get('pagina') || '0', 10) || 0);

  try {
    const base = () => new URLSearchParams({
      limit: String(POR_PAGINA),
      offset: String(pagina * POR_PAGINA),
      situacao: 'A',
    });

    if (!q) {
      const r = await listar(base());
      return res.status(200).json({ total: r.total, pagina, porPagina: POR_PAGINA, itens: mapear(r.itens) });
    }

    /* A API v3 tem dois filtros distintos e nenhum deles cobre o outro:
         nome    -> descrição do produto
         codigo  -> SKU
       Quem digita um SKU no campo de busca não acha nada procurando por nome,
       e vice-versa. Então as duas buscas são feitas e os resultados juntados.
       As alternativas comuns (pesquisa, descricao, search, q, sku) são
       ignoradas em silêncio: a API responde 200 com o catálogo inteiro. */
    const porNome = base();
    porNome.set('nome', q);

    const porCodigo = base();
    porCodigo.set('codigo', q);

    const [rNome, rCodigo] = await Promise.all([
      listar(porNome).catch(() => ({ itens: [], total: 0 })),
      listar(porCodigo).catch(() => ({ itens: [], total: 0 })),
    ]);

    /* código primeiro: quem busca por SKU quer aquele item exato no topo */
    const vistos = new Set();
    const juntos = [];
    for (const item of rCodigo.itens.concat(rNome.itens)) {
      if (!item || vistos.has(item.id)) continue;
      vistos.add(item.id);
      juntos.push(item);
    }

    let r = {
      itens: juntos.slice(0, POR_PAGINA),
      total: rCodigo.itens.length ? juntos.length : rNome.total,
    };
    let aproximada = false;

    /* O Olist casa a frase literal. Como o cadastro é cheio de abreviação
       ("PAINEL LED EMB QD"), quem digita "painel led embutir" não acha nada.
       Nesse caso repete a busca pela palavra mais significativa e depois
       filtra aqui pelas demais, o que devolve o que a pessoa esperava. */
    const palavras = q.split(/\s+/).filter((p) => p.length > 2);
    if (!r.itens.length && palavras.length > 1) {
      const alvos = palavras.map(normalizar);

      /* Tenta palavra por palavra, na ordem digitada. A primeira costuma ser
         o tipo do produto ("painel", "miluz") e é a que o cadastro escreve por
         extenso; as seguintes é que aparecem abreviadas. Escolher a palavra
         mais longa dava errado justamente por isso: "embutir" está cadastrado
         como "EMB" e a busca voltava vazia. */
      for (const palavra of palavras) {
        const p2 = base();
        p2.set('nome', palavra);
        p2.set('limit', '100');
        p2.set('offset', '0');
        const bruto = await listar(p2);
        if (!bruto.itens.length) continue;

        /* casa pelo começo da palavra, para "embutir" encontrar "EMB" */
        const filtrados = bruto.itens.filter((item) => {
          const nome = normalizar(item.descricao);
          return alvos.every((a) => nome.includes(a) || nome.includes(a.slice(0, 3)));
        });

        if (filtrados.length) {
          r = { itens: filtrados.slice(0, POR_PAGINA), total: filtrados.length };
          aproximada = true;
          break;
        }
      }
    }

    return res.status(200).json({
      total: r.total,
      pagina,
      porPagina: POR_PAGINA,
      /* o painel avisa quando o resultado veio de busca aproximada */
      aproximada,
      itens: mapear(r.itens),
    });
  } catch (err) {
    const status = err instanceof ErroOlist ? err.status : 500;
    return res.status(status).json({ erro: err.message });
  }
});
