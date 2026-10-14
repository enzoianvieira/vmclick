/**
 * /api/pedidos-admin  (só com sessão do painel)
 *
 *   GET            -> pedidos mais recentes, resumidos para a lista
 *   GET  ?id=...   -> um pedido completo, com cliente e endereço
 *   POST { id, acao, rastreio? }
 *        acao "separacao"  pago -> em separação
 *        acao "enviado"    -> enviado (ou pronto para retirar), com rastreio opcional
 *        acao "entregue"   enviado -> entregue (ou retirado)
 *        acao "cancelar"   aguardando/vencido -> cancelado, e a cobrança sai do Asaas
 *        acao "olist"      lança no Olist de novo, quando o envio automático falhou
 *
 * Aqui aparecem nome, CPF, e-mail, telefone e endereço: só o painel, com
 * sessão, chega neste endpoint.
 */

const { protegido } = require('./_sessao.js');
const pedidos = require('./_pedido.js');
const asaas = require('./_asaas.js');

const LIMITE_LISTA = 300;

const ACOES = { separacao: 'separacao', enviado: 'enviado', entregue: 'entregue', cancelar: 'cancelado' };

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

function resumo(p) {
  const e = p.entrega || {};
  return {
    id: p.id,
    numero: p.numero,
    criadoEm: p.criadoEm,
    status: p.status,
    forma: p.forma,
    total: p.total,
    cliente: p.cliente && p.cliente.nome,
    local: e.opcao && e.opcao.tipo === 'retirada' ? 'Retirada na loja' : [e.cidade, e.uf].filter(Boolean).join('/'),
    entrega: e.opcao && e.opcao.servico,
    tipoEntrega: e.opcao && e.opcao.tipo,
    itens: (p.itens || []).reduce((s, i) => s + i.qtd, 0),
    olist: p.olist ? p.olist.numero : null,
    olistErro: Boolean(p.olistErro),
  };
}

/* texto limpo, curto, sem marcação: vai para a página pública do pedido */
function limpar(v, max) {
  return String(v == null ? '' : v).replace(/[<>"'`]/g, '').trim().slice(0, max);
}

module.exports = protegido(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      if (id) {
        const p = await pedidos.ler(id);
        return p ? res.status(200).json(p) : res.status(404).json({ erro: 'Pedido não encontrado.' });
      }
      const lista = await pedidos.recentes(LIMITE_LISTA);
      return res.status(200).json({ pedidos: lista.map(resumo) });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ erro: 'Use GET ou POST' });
    }

    const { id, acao, rastreio } = lerCorpo(req);
    const atual = await pedidos.ler(id);
    if (!atual) return res.status(404).json({ erro: 'Pedido não encontrado.' });

    let p;
    if (acao === 'olist') {
      if (['aguardando', 'vencido', 'cancelado', 'falhou', 'recusado'].includes(atual.status)) {
        return res.status(409).json({ erro: 'Só pedido pago vai para o Olist.' });
      }
      p = await pedidos.enviarAoOlist(id);
      if (p.olistErro) return res.status(502).json({ erro: p.olistErro.mensagem, pedido: p });
    } else if (ACOES[acao]) {
      if (acao === 'cancelar' && atual.asaas && atual.asaas.cobranca) {
        await asaas.cancelarCobranca(atual.asaas.cobranca);
      }
      const extra = {};
      if (acao === 'enviado' && rastreio && (rastreio.codigo || rastreio.url)) {
        const url = limpar(rastreio.url, 300);
        extra.rastreio = {
          codigo: limpar(rastreio.codigo, 60),
          /* só link https vai para a página do cliente */
          url: /^https:\/\//i.test(url) ? url : '',
        };
      }
      p = await pedidos.mudarStatus(id, ACOES[acao], `painel:${req.sessao.u}`, extra);
      if (!p || p.status !== ACOES[acao]) {
        return res.status(409).json({ erro: `Não dá para passar de "${atual.status}" para "${ACOES[acao]}".` });
      }
    } else {
      return res.status(400).json({ erro: 'Ação desconhecida.' });
    }

    console.log(`[pedidos-admin] ${req.sessao.u}: ${atual.numero} ${acao}`);
    return res.status(200).json(p);
  } catch (e) {
    console.error('[pedidos-admin] falha:', e);
    return res.status(500).json({ erro: 'Não foi possível concluir agora.' });
  }
});
