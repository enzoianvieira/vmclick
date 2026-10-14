/**
 * POST /api/pagamento/webhook
 *
 * Avisos do Asaas sobre as cobranças: pago, vencido, removido, estornado.
 * Cadastrar em Asaas > Integrações > Webhooks, com:
 *   URL          https://<site>/api/pagamento/webhook
 *   Token        gerado pelo painel (aba Integrações > Configurar webhook),
 *                ou o valor de ASAAS_WEBHOOK_TOKEN
 *   Eventos      de cobrança (PAYMENT_*)
 *
 * TRÊS CUIDADOS
 *
 * 1. Autenticação. Esta URL é pública; sem conferir o token, qualquer um
 *    mandaria "PAYMENT_RECEIVED" e ganharia um pedido pago sem pagar. Mesmo
 *    com o token certo, "pago" só vale depois de confirmado na API do Asaas.
 *
 * 2. Repetição. O Asaas entrega "pelo menos uma vez": o mesmo evento pode
 *    chegar duas vezes. O id do evento fica registrado, e as mudanças de
 *    status já não se repetem (ver mudarStatus em _pedido.js).
 *
 * 3. Resposta. Qualquer coisa diferente de 200 faz o Asaas tentar de novo, e
 *    depois de 15 falhas seguidas ele PAUSA a fila inteira. Por isso evento
 *    desconhecido ou de cobrança que não é do site recebe 200; só falha de
 *    verdade (KV fora do ar, por exemplo) responde erro, para ser reenviada.
 */

const crypto = require('crypto');

const asaas = require('../_asaas.js');
const pedidos = require('../_pedido.js');
const armazem = require('../_armazem.js');
const config = require('../_config.js');

const EVENTO_PARA_STATUS = {
  PAYMENT_CONFIRMED: 'pago',
  PAYMENT_RECEIVED: 'pago',
  PAYMENT_OVERDUE: 'vencido',
  PAYMENT_DELETED: 'cancelado',
  PAYMENT_REFUNDED: 'estornado',
  PAYMENT_CHARGEBACK_REQUESTED: 'contestado',
  PAYMENT_CHARGEBACK_DISPUTE: 'contestado',
};

const EVENTO_VALIDADE_S = 30 * 24 * 3600;

/* Compara contra cada token aceito (atual, anterior, variável de ambiente)
   em tempo constante. */
function tokenConfere(recebido, aceitos) {
  const a = Buffer.from(String(recebido || ''));
  let ok = false;
  for (const esperado of aceitos) {
    const b = Buffer.from(esperado);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Use POST' });
  }

  const { webhookTokens } = await config.asaas();
  if (!webhookTokens.length) {
    console.error('[webhook] nenhum token de webhook configurado (painel ou ASAAS_WEBHOOK_TOKEN)');
    return res.status(503).json({ erro: 'não configurado' });
  }
  if (!tokenConfere(req.headers['asaas-access-token'], webhookTokens)) {
    return res.status(401).json({ erro: 'token inválido' });
  }

  const corpo = lerCorpo(req);
  const evento = String(corpo.event || '');
  const cobranca = corpo.payment || {};
  const novo = EVENTO_PARA_STATUS[evento];

  if (!novo || !cobranca.id) return res.status(200).json({ ok: true, ignorado: evento || 'sem evento' });

  try {
    const chaveEvento = corpo.id ? `vmclick:asaas:evento:${corpo.id}` : null;
    if (chaveEvento && await armazem.ler(chaveEvento)) {
      return res.status(200).json({ ok: true, repetido: true });
    }

    const id = await pedidos.pedidoDaCobranca(cobranca);
    if (!id) {
      /* Cobrança criada à mão no painel, ou de outro sistema: não é do site. */
      return res.status(200).json({ ok: true, ignorado: 'cobrança sem pedido' });
    }

    if (novo === 'pago') {
      const real = await asaas.consultarCobranca(cobranca.id);
      if (!real.pago) {
        console.warn(`[webhook] ${evento} para ${cobranca.id}, mas o Asaas diz ${real.status}`);
        return res.status(200).json({ ok: true, ignorado: 'não confirmado na API' });
      }
    }

    const pedido = await pedidos.mudarStatus(id, novo, evento);

    /* Marca o evento só depois de processado: se algo acima falhar, o
       reenvio do Asaas tenta de novo em vez de ser descartado. */
    if (chaveEvento) await armazem.gravar(chaveEvento, 1, EVENTO_VALIDADE_S);

    return res.status(200).json({ ok: true, status: pedido ? pedido.status : 'sem mudança' });
  } catch (e) {
    console.error('[webhook] falha ao processar', evento, cobranca.id, e);
    return res.status(500).json({ erro: 'falha temporária' });
  }
};
