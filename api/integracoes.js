/**
 * /api/integracoes  (só com sessão do painel)
 *
 *   GET   -> situação das integrações: modo (teste/produção), se há chave em
 *            cada ambiente e o final dela. A chave em si nunca sai daqui.
 *   POST  { integracao: "asaas" | "melhorenvio", acao, ambiente, valor }
 *
 *   acao "chave"    testa a chave/token naquele ambiente e, se funcionar, guarda
 *   acao "remover"  apaga a chave daquele ambiente
 *   acao "ambiente" passa a usar aquele ambiente (exige chave cadastrada nele)
 *   acao "testar"   testa o que está guardado para aquele ambiente
 *   acao "webhook"  (Asaas) cria ou atualiza o webhook do site na conta
 *
 * Chave só é guardada depois de testada: colar a chave errada não pode
 * derrubar o checkout sem ninguém perceber.
 */

const { protegido } = require('./_sessao.js');
const config = require('./_config.js');
const asaas = require('./_asaas.js');
const { testarConexao, ErroFrete } = require('./_frete.js');
const email = require('./_email.js');
const olist = require('./_olist.js');

const ROTULO = { sandbox: 'teste', producao: 'produção' };

class ErroPainel extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

/** Endereço público do site, para montar a URL do webhook. */
function enderecoDoSite(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  const padrao = /^(localhost|127\.|\[::1\])/.test(host) ? 'http' : 'https';
  const proto = String(req.headers['x-forwarded-proto'] || padrao).split(',')[0];
  return `${proto}://${host}`;
}

function local(url) {
  return /^https?:\/\/(localhost|127\.|\[::1\]|[^/]*\.localhost)/i.test(url);
}

/* --------------------------------------------------------------- testes --- */

async function testarAsaas(ambiente, chave) {
  if (!chave) throw new ErroPainel(400, `Nenhuma chave do Asaas cadastrada em ${ROTULO[ambiente]}.`);
  try {
    const r = await asaas.testar({ ambiente, chave });
    const saldo = `Conectado ao Asaas (${ROTULO[ambiente]}). Saldo: ${r.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`;
    /* Sem chave Pix o Asaas não gera QR code: melhor saber aqui do que no
       primeiro cliente que escolher Pix. */
    if (r.chavesPix === 0) {
      return `${saldo} ATENÇÃO: a conta não tem chave Pix cadastrada - o Pix não vai funcionar. Cadastre uma em Pix > Minhas chaves no Asaas.`;
    }
    return saldo;
  } catch (e) {
    throw new ErroPainel(400, `O Asaas recusou a chave em ${ROTULO[ambiente]}: ${e.message}`);
  }
}

async function testarMelhorEnvio(ambiente, token) {
  if (!token) throw new ErroPainel(400, `Nenhum token do Melhor Envio cadastrado em ${ROTULO[ambiente]}.`);
  try {
    const r = await testarConexao(ambiente, token);
    return r.servicos.length
      ? `Conectado ao Melhor Envio (${ROTULO[ambiente]}). Cotou: ${r.servicos.join(', ')}.`
      : `Conectado ao Melhor Envio (${ROTULO[ambiente]}), mas nenhuma transportadora cotou para São Paulo. Confira as transportadoras ativas.`;
  } catch (e) {
    throw new ErroPainel(400, `O Melhor Envio recusou o token em ${ROTULO[ambiente]}: ${e.message}`);
  }
}

/* --------------------------------------------------------------- ações ---- */

async function acaoAsaas(acao, ambiente, valor, req) {
  if (acao === 'chave') {
    const chave = String(valor || '').trim();
    if (!/^\$aact_/.test(chave)) throw new ErroPainel(400, 'Chave do Asaas começa com $aact_. Copie a chave inteira.');
    if (!asaas.chaveCombinaComAmbiente(chave, ambiente)) {
      throw new ErroPainel(400, ambiente === 'producao'
        ? 'Esta é uma chave de teste ($aact_hmlg_). Em produção use a chave da conta real ($aact_prod_).'
        : 'Esta é uma chave de produção ($aact_prod_). Em teste use a chave do sandbox ($aact_hmlg_).');
    }
    const mensagem = await testarAsaas(ambiente, chave);
    await config.definirSegredo('asaas', ambiente, 'chave', chave);
    return mensagem + ' Chave salva.';
  }

  if (acao === 'remover') {
    const atual = await config.asaas();
    if (atual.ambiente === ambiente) {
      throw new ErroPainel(409, `Esta chave está em uso. Mude o modo antes de removê-la.`);
    }
    await config.definirSegredo('asaas', ambiente, 'chave', '');
    return `Chave de ${ROTULO[ambiente]} removida.`;
  }

  if (acao === 'testar') return testarAsaas(ambiente, await config.chaveAsaas(ambiente));

  if (acao === 'ambiente') {
    if (!(await config.chaveAsaas(ambiente))) {
      throw new ErroPainel(409, `Cadastre a chave de ${ROTULO[ambiente]} antes de ativar esse modo.`);
    }
    await config.definirAmbiente('asaas', ambiente);
    return ambiente === 'producao'
      ? 'Asaas em PRODUÇÃO: as próximas compras cobram de verdade.'
      : 'Asaas em modo de teste: nenhuma compra cobra de verdade.';
  }

  if (acao === 'webhook') {
    const chave = await config.chaveAsaas(ambiente);
    if (!chave) throw new ErroPainel(409, `Cadastre a chave de ${ROTULO[ambiente]} antes de configurar o webhook.`);

    const url = `${enderecoDoSite(req)}/api/pagamento/webhook`;
    if (local(url)) {
      throw new ErroPainel(400, 'O Asaas não alcança o seu computador. Configure o webhook pelo painel do site publicado.');
    }

    const email = process.env.ASAAS_WEBHOOK_EMAIL || 'contato@vmclick.com.br';
    let r;
    try {
      r = await asaas.configurarWebhook(url, email, { ambiente, chave });
    } catch (e) {
      throw new ErroPainel(400, `O Asaas recusou o webhook: ${e.message}`);
    }

    /* Guardado só depois do Asaas aceitar. O token anterior continua valendo
       para os avisos que já estavam na fila. */
    try {
      await config.definirWebhook(ambiente, { id: r.id, token: r.token });
    } catch (e) {
      throw new ErroPainel(500, 'Webhook atualizado no Asaas, mas não deu para guardar o token aqui. Clique de novo em "Configurar webhook".');
    }
    return `Webhook ${r.atualizado ? 'atualizado' : 'criado'} no Asaas (${ROTULO[ambiente]}): ${url}`;
  }

  throw new ErroPainel(400, 'Ação desconhecida');
}

async function acaoMelhorEnvio(acao, ambiente, valor) {
  if (acao === 'chave') {
    const token = String(valor || '').trim().replace(/^Bearer\s+/i, '');
    /* O token pessoal é um JWT (três partes separadas por ponto, ~1000
       caracteres). O engano comum é colar o Client Secret do aplicativo da
       "Área Dev", que tem 40 caracteres e não autentica nada sozinho. */
    if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token) || token.length < 200) {
      throw new ErroPainel(400, token.length <= 64
        ? 'Isso parece o Client Secret de um aplicativo, não um token. No Melhor Envio, vá em Integrações > Permissões de acesso > Gerar novo token e cole o token inteiro (começa com eyJ).'
        : 'Token incompleto. Copie o token inteiro gerado em Integrações > Permissões de acesso (começa com eyJ).');
    }
    const mensagem = await testarMelhorEnvio(ambiente, token);
    await config.definirSegredo('melhorenvio', ambiente, 'token', token);
    return mensagem + ' Token salvo.';
  }

  if (acao === 'remover') {
    await config.definirSegredo('melhorenvio', ambiente, 'token', '');
    return `Token de ${ROTULO[ambiente]} removido.`;
  }

  if (acao === 'testar') {
    const token = await config.tokenMelhorEnvio(ambiente);
    if (token) return testarMelhorEnvio(ambiente, token);
    throw new ErroPainel(400, `Nenhum token do Melhor Envio cadastrado no painel em ${ROTULO[ambiente]}.`);
  }

  if (acao === 'ambiente') {
    const oauthAmbiente = process.env.MELHORENVIO_AMBIENTE === 'producao' ? 'producao' : 'sandbox';
    const temOauth = Boolean(process.env.MELHORENVIO_REFRESH_TOKEN) && oauthAmbiente === ambiente;
    if (!(await config.tokenMelhorEnvio(ambiente)) && !temOauth) {
      throw new ErroPainel(409, `Cadastre o token de ${ROTULO[ambiente]} antes de ativar esse modo.`);
    }
    await config.definirAmbiente('melhorenvio', ambiente);
    return ambiente === 'producao'
      ? 'Melhor Envio em PRODUÇÃO: cotações com os preços reais.'
      : 'Melhor Envio em modo de teste.';
  }

  throw new ErroPainel(400, 'Ação desconhecida');
}

/* E-mail (Resend): chave, remetente e envio de teste. Sem ambientes. */
async function acaoEmail(acao, valor) {
  valor = valor || {};
  const atual = await config.email();

  if (acao === 'salvar') {
    const chave = valor.chave !== undefined ? String(valor.chave || '').trim() : undefined;
    const remetente = String(valor.remetente || '').trim();
    if (!/^[^<>]*<?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(remetente)) {
      throw new ErroPainel(400, 'Remetente inválido. Ex.: VM Click <pedidos@vmclick.com.br>');
    }
    if (chave !== undefined && chave && !/^re_[A-Za-z0-9_]+$/.test(chave)) {
      throw new ErroPainel(400, 'A chave do Resend começa com re_. Copie a chave inteira.');
    }
    const testar = chave || atual.chave;
    if (!testar) throw new ErroPainel(400, 'Cole a chave do Resend.');
    let r;
    try { r = await email.testar(testar, remetente); } catch (e) { throw new ErroPainel(400, e.message); }
    await config.definirEmail({ chave: chave || undefined, remetente });
    if (!r.cadastrado) return `Chave salva. ATENÇÃO: o domínio ${r.dominio} não está cadastrado no Resend - cadastre e verifique o domínio, senão os e-mails só chegam ao dono da conta.`;
    if (!r.verificado) return `Chave salva. O domínio ${r.dominio} ainda não foi verificado no Resend (confira os registros DNS).`;
    return `E-mail configurado. Domínio ${r.dominio} verificado.`;
  }

  if (acao === 'teste') {
    const para = String(valor.para || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) throw new ErroPainel(400, 'Informe um e-mail para receber o teste.');
    try {
      await email.enviar({
        para,
        assunto: 'Teste de e-mail - VM Click',
        html: '<p>Se você recebeu esta mensagem, os e-mails do site estão funcionando.</p>',
        texto: 'Se você recebeu esta mensagem, os e-mails do site estão funcionando.',
        lancar: true,
      });
    } catch (e) {
      throw new ErroPainel(400, e.message);
    }
    return `E-mail de teste enviado para ${para}. Confira a caixa de entrada (e o spam).`;
  }

  if (acao === 'remover') {
    await config.definirEmail({ chave: '' });
    return 'Chave do Resend removida.';
  }

  throw new ErroPainel(400, 'Ação desconhecida');
}

/* Olist: conferir permissões e trocar o token depois de reautorizar. */
async function acaoOlist(acao, valor) {
  const descrever = (p) => {
    const falta = ['produtos', 'contatos', 'pedidos'].filter((k) => !p[k]);
    return falta.length
      ? `Conectado, mas sem permissão de ${falta.join(', ')}. Libere no aplicativo do Olist, autorize de novo e cole o token novo aqui.`
      : 'Conectado ao Olist com permissão de Produtos, Contatos e Pedidos.';
  };

  if (acao === 'verificar') {
    try { return descrever(await olist.verificarPermissoes()); } catch (e) { throw new ErroPainel(400, e.message); }
  }

  if (acao === 'token') {
    const token = String((valor && valor.token) || '').trim();
    if (token.length < 100 || /\s/.test(token)) {
      throw new ErroPainel(400, 'Cole o TINY_REFRESH_TOKEN inteiro, do .env, logo depois de rodar npm run get-token.');
    }
    try {
      await olist.conectarComRefresh(token);
      return 'Token novo salvo. ' + descrever(await olist.verificarPermissoes());
    } catch (e) {
      throw new ErroPainel(400, e.message);
    }
  }

  throw new ErroPainel(400, 'Ação desconhecida');
}

/* -------------------------------------------------------------- handler --- */

module.exports = protegido(async (req, res) => {
  try {
    if (req.method === 'GET') {
      const r = await config.resumo();
      r.webhookUrl = `${enderecoDoSite(req)}/api/pagamento/webhook`;
      r.webhookLocal = local(r.webhookUrl);
      return res.status(200).json(r);
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ erro: 'Use GET ou POST' });
    }

    const { integracao, acao, ambiente, valor } = lerCorpo(req);

    let mensagem;
    if (integracao === 'olist') {
      mensagem = await acaoOlist(acao, valor);
      console.log(`[integracoes] ${req.sessao.u}: olist ${acao}`);
      return res.status(200).json({ ok: true, mensagem, situacao: await config.resumo() });
    }
    if (integracao === 'email') {
      mensagem = await acaoEmail(acao, valor);
      console.log(`[integracoes] ${req.sessao.u}: email ${acao}`);
      return res.status(200).json({ ok: true, mensagem, situacao: await config.resumo() });
    }
    if (!config.AMBIENTES.includes(ambiente)) throw new ErroPainel(400, 'Ambiente inválido');

    if (integracao === 'asaas') mensagem = await acaoAsaas(acao, ambiente, valor, req);
    else if (integracao === 'melhorenvio') mensagem = await acaoMelhorEnvio(acao, ambiente, valor);
    else throw new ErroPainel(400, 'Integração desconhecida');

    console.log(`[integracoes] ${req.sessao.u}: ${integracao} ${acao} ${ambiente}`);
    return res.status(200).json({ ok: true, mensagem, situacao: await config.resumo() });
  } catch (e) {
    if (e instanceof ErroPainel || e instanceof ErroFrete) return res.status(e.status).json({ erro: e.message });
    console.error('[integracoes] falha:', e);
    return res.status(500).json({ erro: e.message || 'Falha ao salvar a configuração.' });
  }
});
