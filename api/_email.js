/**
 * VM Click - e-mails do site (Resend)
 *
 *   - código de acesso do "Minha conta";
 *   - pedido recebido (com o link para pagar Pix ou boleto);
 *   - pagamento confirmado;
 *   - pedido enviado (com rastreio) ou pronto para retirar.
 *
 * Chave e remetente vêm do painel (Integrações > E-mail) ou das variáveis
 * RESEND_API_KEY e EMAIL_REMETENTE. Sem chave, nada é enviado e nada
 * quebra: e-mail é aviso, nunca condição para a venda andar.
 *
 * O remetente precisa ser de um domínio verificado no Resend (ex.:
 * pedidos@vmclick.com.br). Antes disso o Resend só entrega para o e-mail da
 * própria conta - serve para testar.
 */

const config = require('./_config.js');

const API = 'https://api.resend.com';

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Endereço público do site, para os links dos e-mails. */
function site() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'https://vmclick.vercel.app';
}

/* ------------------------------------------------------------- envio ---- */

/**
 * Envia um e-mail. `chaveUnica` evita mandar o mesmo aviso duas vezes
 * quando o webhook do pagamento chega repetido (Idempotency-Key do Resend).
 * Devolve true se enviou; nunca lança, salvo com `{ lancar: true }`.
 */
async function enviar({ para, assunto, html, texto, chaveUnica, lancar }, cfgTeste) {
  const c = cfgTeste || await config.email();
  if (!c.chave || !c.remetente) {
    if (lancar) throw new Error('E-mail não configurado (chave e remetente).');
    console.warn('[email] não configurado; pulando:', assunto);
    return false;
  }
  try {
    const headers = {
      Authorization: `Bearer ${c.chave}`,
      'Content-Type': 'application/json',
    };
    if (chaveUnica) headers['Idempotency-Key'] = chaveUnica.slice(0, 256);

    const res = await fetch(`${API}/emails`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ from: c.remetente, to: [para], subject: assunto, html, text: texto }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(`Resend respondeu ${res.status}${j.message ? ': ' + j.message : ''}`);
    }
    return true;
  } catch (e) {
    console.error('[email] falhou:', assunto, '-', e.message);
    if (lancar) throw e;
    return false;
  }
}

/** Para o painel: a chave vale? E o domínio do remetente está verificado? */
async function testar(chave, remetente) {
  const res = await fetch(`${API}/domains`, {
    headers: { Authorization: `Bearer ${chave}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 401 || res.status === 403) throw new Error('Chave do Resend inválida.');
  if (!res.ok) throw new Error(`Resend respondeu ${res.status}.`);
  const j = await res.json();
  const dominio = (String(remetente || '').match(/@([^>\s]+)/) || [])[1];
  const achado = (j.data || []).find((d) => d.name === dominio);
  return { dominio, verificado: Boolean(achado && achado.status === 'verified'), cadastrado: Boolean(achado) };
}

/* --------------------------------------------------------- moldura ---- */

/* HTML de e-mail: tabela e estilo inline, que é o que os clientes de
   e-mail respeitam. Cores da marca. */
function moldura(titulo, corpo, botao) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F3F6F5;font-family:Arial,Helvetica,sans-serif;color:#0F1F1D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F5;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #DDE5E3;border-radius:12px">
<tr><td style="background:#04403A;border-radius:12px 12px 0 0;padding:18px 24px;color:#FFFFFF;font-size:18px;font-weight:bold">VM Click</td></tr>
<tr><td style="padding:28px 24px 8px"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(titulo)}</h1>${corpo}</td></tr>
${botao ? `<tr><td style="padding:8px 24px 28px"><a href="${esc(botao.url)}" style="display:inline-block;background:#076E65;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${esc(botao.texto)}</a></td></tr>` : ''}
<tr><td style="padding:16px 24px;border-top:1px solid #E3E9E7;font-size:12px;color:#4F615E;line-height:1.5">VM Click · R. Amadeu do Amaral, 1602 - Portão, Curitiba/PR<br>Dúvidas? Responda pelo WhatsApp (41) 99892-0006.</td></tr>
</table></td></tr></table></body></html>`;
}

function p(texto) {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${texto}</p>`;
}

function resumoItens(pedido) {
  const linhas = pedido.itens.map((i) =>
    `<tr><td style="padding:6px 0;font-size:14px">${i.qtd}× ${esc(i.nome)}</td><td align="right" style="padding:6px 0;font-size:14px;white-space:nowrap">${brl(i.sub)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-top:1px solid #E3E9E7;border-bottom:1px solid #E3E9E7">${linhas}
<tr><td style="padding:6px 0;font-size:14px;color:#4F615E">Frete · ${esc(pedido.entrega.opcao.servico)}</td><td align="right" style="padding:6px 0;font-size:14px">${pedido.entrega.aCombinar ? 'a combinar' : brl(pedido.frete)}</td></tr>
${pedido.desconto ? `<tr><td style="padding:6px 0;font-size:14px;color:#157F3B">Desconto Pix</td><td align="right" style="padding:6px 0;font-size:14px;color:#157F3B">− ${brl(pedido.desconto)}</td></tr>` : ''}
<tr><td style="padding:8px 0;font-size:15px;font-weight:bold">Total</td><td align="right" style="padding:8px 0;font-size:15px;font-weight:bold">${brl(pedido.total)}</td></tr></table>`;
}

const primeiroNome = (pedido) => esc(String(pedido.cliente.nome || '').split(/\s+/)[0]);
const linkPedido = (pedido) => `${site()}/pedido.html?id=${encodeURIComponent(pedido.id)}`;

/* -------------------------------------------------------- mensagens ---- */

function codigoAcesso(email, codigo) {
  return enviar({
    para: email,
    assunto: `${codigo} é o seu código de acesso - VM Click`,
    html: moldura('Seu código de acesso',
      p('Use este código para entrar em <b>Minha conta</b> no site da VM Click:') +
      `<p style="margin:8px 0 16px;font-size:32px;font-weight:bold;letter-spacing:8px;font-family:'Courier New',monospace">${esc(codigo)}</p>` +
      p('Ele vale por 10 minutos. Se não foi você quem pediu, ignore este e-mail.')),
    texto: `Seu código de acesso à VM Click: ${codigo}. Vale por 10 minutos.`,
    lancar: true,
  });
}

/** Pedido criado aguardando Pix ou boleto: o link para pagar. */
function pedidoRecebido(pedido) {
  const forma = pedido.forma === 'pix' ? 'o Pix' : 'o boleto';
  return enviar({
    para: pedido.cliente.email,
    assunto: `Pedido ${pedido.numero} recebido - falta o pagamento`,
    html: moldura(`Recebemos seu pedido, ${primeiroNome(pedido)}!`,
      p(`O pedido <b>${esc(pedido.numero)}</b> está reservado. Assim que ${forma} for pago, a gente começa a separar.`) +
      resumoItens(pedido),
      { texto: pedido.forma === 'pix' ? 'Pagar com Pix' : 'Ver o boleto', url: linkPedido(pedido) }),
    texto: `Pedido ${pedido.numero} recebido. Pague e acompanhe em ${linkPedido(pedido)}`,
    chaveUnica: `${pedido.id}:recebido`,
  });
}

function pagamentoConfirmado(pedido) {
  const retirada = pedido.entrega.opcao.tipo === 'retirada';
  return enviar({
    para: pedido.cliente.email,
    assunto: `Pagamento confirmado - pedido ${pedido.numero}`,
    html: moldura('Pagamento confirmado!',
      p(`Obrigado, ${primeiroNome(pedido)}. O pagamento do pedido <b>${esc(pedido.numero)}</b> foi aprovado e já estamos separando os produtos.`) +
      p(retirada
        ? 'Avisamos por aqui quando estiver pronto para retirar na loja (R. Amadeu do Amaral, 1602 - Portão).'
        : 'Você recebe outro e-mail com o código de rastreio assim que o pedido for enviado.') +
      resumoItens(pedido),
      { texto: 'Acompanhar pedido', url: linkPedido(pedido) }),
    texto: `Pagamento do pedido ${pedido.numero} confirmado. Acompanhe em ${linkPedido(pedido)}`,
    chaveUnica: `${pedido.id}:pago`,
  });
}

function pedidoEnviado(pedido) {
  const retirada = pedido.entrega.opcao.tipo === 'retirada';
  const r = pedido.rastreio || {};
  const rastreio = r.codigo
    ? p(`Código de rastreio: <b style="font-family:'Courier New',monospace">${esc(r.codigo)}</b>`) +
      (r.url ? p(`<a href="${esc(r.url)}" style="color:#076E65">Rastrear a entrega</a>`) : '')
    : '';
  return enviar({
    para: pedido.cliente.email,
    assunto: retirada ? `Pedido ${pedido.numero} pronto para retirar` : `Pedido ${pedido.numero} enviado`,
    html: moldura(retirada ? 'Seu pedido está pronto!' : 'Seu pedido está a caminho!',
      (retirada
        ? p(`O pedido <b>${esc(pedido.numero)}</b> está separado. Retire na loja: R. Amadeu do Amaral, 1602 - Portão, Curitiba.`) +
          p('Segunda a sexta, 8h às 18h · sábado, 8h às 13h. Leve um documento com foto.')
        : p(`O pedido <b>${esc(pedido.numero)}</b> foi enviado por ${esc(pedido.entrega.opcao.transportadora || pedido.entrega.opcao.servico)}.`) + rastreio),
      { texto: 'Acompanhar pedido', url: linkPedido(pedido) }),
    texto: `Pedido ${pedido.numero} ${retirada ? 'pronto para retirar' : 'enviado'}. ${r.codigo ? 'Rastreio: ' + r.codigo + '. ' : ''}${linkPedido(pedido)}`,
    chaveUnica: `${pedido.id}:enviado`,
  });
}

module.exports = { enviar, testar, codigoAcesso, pedidoRecebido, pagamentoConfirmado, pedidoEnviado, site };
