/**
 * VM Click - cotação de frete (Melhor Envio), lado servidor
 *
 * POR QUE ISTO FICA NO SERVIDOR
 * O token do Melhor Envio permite cotar E COMPRAR etiqueta com o saldo da
 * conta. No navegador, qualquer visitante o copiaria do DevTools. Então o
 * front só conversa com /api/frete/cotar e nunca vê a credencial.
 *
 * O peso e as medidas também são resolvidos aqui, a partir do catálogo, e não
 * aceitos do navegador: quem manda o pacote manda o preço do frete.
 *
 * Ambiente e token podem vir do painel administrativo (aba Integrações):
 * um token pessoal do Melhor Envio, por ambiente. Sem ele, vale o fluxo
 * OAuth com as variáveis de ambiente abaixo (painel da Vercel):
 *   MELHORENVIO_AMBIENTE        sandbox | producao   (padrão: sandbox)
 *   MELHORENVIO_CLIENT_ID
 *   MELHORENVIO_CLIENT_SECRET
 *   MELHORENVIO_REFRESH_TOKEN   semente; depois rotaciona sozinho
 *   MELHORENVIO_USER_AGENT      exigido pelo Melhor Envio: nome e e-mail
 *   MELHORENVIO_SERVICOS        opcional, ids separados por vírgula
 *   FRETE_CEP_ORIGEM            CEP da loja
 *   FRETE_CEP_LOCAL             faixas da entrega própria, ver CEPS_LOCAIS
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const credenciais = require('./_credenciais.js');
const config = require('./_config.js');

const CHAVE_TOKEN = 'vmclick:melhorenvio:refresh_token';

const BASES = {
  sandbox: 'https://sandbox.melhorenvio.com.br',
  producao: 'https://melhorenvio.com.br',
};

class ErroFrete extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

/* ==========================================================================
   Catálogo: peso e medidas
   ========================================================================== */

/* data/produtos.js é gerado pelo sync e atribui a window. Lido aqui com um
   window de mentira, em vez de duplicar os dados num JSON à parte: assim o
   frete nunca fica defasado em relação ao que a loja mostra. O arquivo entra
   no pacote da função pelo includeFiles do vercel.json. */
let catalogoCache = null;

function catalogo() {
  if (catalogoCache) return catalogoCache;

  const arquivo = path.join(__dirname, '..', 'data', 'produtos.js');
  const contexto = { window: {} };
  vm.runInNewContext(fs.readFileSync(arquivo, 'utf8'), contexto, { timeout: 5000 });

  catalogoCache = new Map();
  for (const p of contexto.window.VM_PRODUTOS || []) {
    if (p && p.sku) catalogoCache.set(String(p.sku), p);
  }
  return catalogoCache;
}

/** "17.3 cm" -> 17.3 ; "0,225 kg" -> 0.225 ; lixo -> null */
function numeroDaSpec(texto) {
  if (texto == null) return null;
  const n = parseFloat(String(texto).replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Medidas de embalagem usadas quando o produto não traz as suas. Não é chute
   otimista de propósito: frete a menos sai do bolso da loja, frete a mais o
   cliente reclama antes de comprar. */
const PADRAO = { largura: 16, altura: 8, comprimento: 20, peso: 0.6 };

/* O cadastro do Olist tem peso digitado em grama no campo de quilo: existe
   lâmpada de 6 W marcada como "56 kg". Acima deste limite o dado é tratado
   como não confiável e cai no padrão, senão a cotação vem absurda. */
const PESO_SUSPEITO_KG = 40;

function medidasDoProduto(p) {
  const s = (p && p.specs) || {};
  const peso = numeroDaSpec(s['Peso bruto']) || numeroDaSpec(s['Peso líquido']);

  return {
    largura: numeroDaSpec(s['Largura']) || PADRAO.largura,
    altura: numeroDaSpec(s['Altura']) || PADRAO.altura,
    comprimento: numeroDaSpec(s['Comprimento']) || PADRAO.comprimento,
    peso: peso && peso <= PESO_SUSPEITO_KG ? peso : PADRAO.peso,
    confiavel: Boolean(peso && peso <= PESO_SUSPEITO_KG),
  };
}

/* Mínimos do Melhor Envio; abaixo disso a API recusa a cotação. */
const MIN = { largura: 11, altura: 2, comprimento: 16 };

/* Teto do que dá para mandar por transportadora de encomenda. Acima, a venda
   vira orçamento pelo WhatsApp - é rolo de cabo, eletroduto, lata de tinta. */
const MAX_PESO_KG = 30;
const MAX_SOMA_CM = 200;

/**
 * Junta o carrinho numa caixa só: empilha as alturas e fica com a maior
 * largura e o maior comprimento. É a aproximação usual para estimativa, e
 * erra para mais, não para menos.
 */
function montarPacote(itens) {
  const cat = catalogo();
  const caixa = { largura: 0, altura: 0, comprimento: 0, peso: 0 };
  let valor = 0;
  let estimado = false;
  const desconhecidos = [];

  for (const item of itens) {
    const p = cat.get(String(item.sku));
    if (!p) { desconhecidos.push(item.sku); continue; }

    const m = medidasDoProduto(p);
    if (!m.confiavel) estimado = true;

    caixa.largura = Math.max(caixa.largura, m.largura);
    caixa.comprimento = Math.max(caixa.comprimento, m.comprimento);
    caixa.altura += m.altura * item.qtd;
    caixa.peso += m.peso * item.qtd;
    valor += (Number(p.preco) || 0) * item.qtd;
  }

  if (desconhecidos.length) {
    throw new ErroFrete(400, `Produto fora do catálogo: ${desconhecidos.join(', ')}`);
  }

  const pacote = {
    largura: Math.max(MIN.largura, Math.ceil(caixa.largura)),
    altura: Math.max(MIN.altura, Math.ceil(caixa.altura)),
    comprimento: Math.max(MIN.comprimento, Math.ceil(caixa.comprimento)),
    peso: Math.round(caixa.peso * 1000) / 1000,
  };

  const soma = pacote.largura + pacote.altura + pacote.comprimento;
  const excede = pacote.peso > MAX_PESO_KG || soma > MAX_SOMA_CM;

  return { pacote, valor, estimado, excede };
}

/* ==========================================================================
   Entrega própria e retirada
   ========================================================================== */

/* Faixas de CEP no formato "80000000-82999999,83000000-83800999". */
function faixas(texto) {
  return String(texto)
    .split(',')
    .map((faixa) => faixa.split('-').map((n) => parseInt(n.trim(), 10)))
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
}

function dentro(cep, lista) {
  const n = parseInt(cep, 10);
  return lista.some(([a, b]) => n >= a && n <= b);
}

/* Onde a loja faz entrega em até 24h, cotada pelo WhatsApp: Curitiba
   (80000-000 a 82999-999) e região metropolitana (83000-000 a 83800-999). */
const CEPS_LOCAIS = faixas(process.env.FRETE_CEP_LOCAL || '80000000-82999999,83000000-83800999');

/* Onde vale a entrega grátis da própria loja: só Curitiba, decisão da VM
   Click (out/2026) - a região metropolitana fica de fora. */
const CEPS_GRATIS = faixas(process.env.FRETE_CEP_GRATIS || '80000000-82999999');

function atendeEntregaLocal(cep) {
  return dentro(cep, CEPS_LOCAIS);
}

/* ==========================================================================
   Token
   ========================================================================== */

let tokenCache = { valor: null, expiraEm: 0 };

/* Margem antes do vencimento: o token não é usado até o último segundo, senão
   uma requisição longa esbarra na virada. */
const FOLGA_MS = 5 * 60 * 1000;

/**
 * Ambiente e token em uso. Token pessoal cadastrado no painel tem
 * prioridade; sem ele, o access_token do fluxo OAuth - que só vale no
 * ambiente em que foi autorizado (MELHORENVIO_AMBIENTE).
 */
async function conexao() {
  const c = await config.melhorEnvio();
  if (c.token) return { ambiente: c.ambiente, token: c.token };

  const ambienteOauth = process.env.MELHORENVIO_AMBIENTE === 'producao' ? 'producao' : 'sandbox';
  if (ambienteOauth !== c.ambiente) {
    throw new ErroFrete(503,
      `Melhor Envio em modo ${c.ambiente === 'producao' ? 'produção' : 'teste'} sem token cadastrado. Cadastre o token no painel.`);
  }
  return { ambiente: c.ambiente, token: await obterTokenOauth(c.ambiente) };
}

async function obterTokenOauth(ambiente) {
  if (tokenCache.valor && Date.now() < tokenCache.expiraEm - FOLGA_MS) return tokenCache.valor;

  const { MELHORENVIO_CLIENT_ID, MELHORENVIO_CLIENT_SECRET } = process.env;

  /* Guardado: access_token ainda válido dispensa renovar. Importa porque cada
     renovação queima o refresh token atual, e em serverless cada partida a
     frio começa com a memória vazia. */
  const guardado = await credenciais.lerJson(CHAVE_TOKEN);
  if (guardado && guardado.access_token && guardado.expira_em > Date.now() + FOLGA_MS) {
    tokenCache = { valor: guardado.access_token, expiraEm: guardado.expira_em };
    return tokenCache.valor;
  }

  const refresh = (guardado && guardado.refresh_token)
    || process.env.MELHORENVIO_REFRESH_TOKEN;

  if (!MELHORENVIO_CLIENT_ID || !MELHORENVIO_CLIENT_SECRET || !refresh) {
    throw new ErroFrete(503, 'Cotação de frete não configurada no servidor');
  }

  const res = await fetch(`${BASES[ambiente]}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: MELHORENVIO_CLIENT_ID,
      client_secret: MELHORENVIO_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    /* 401 aqui quase sempre é refresh token já gasto: como ele rotaciona a
       cada uso, uma cópia antiga em variável de ambiente para de valer assim
       que outro ambiente renova. A mensagem diz o que fazer. */
    if (res.status === 401) {
      throw new ErroFrete(503,
        'Token do Melhor Envio inválido ou já rotacionado. Rode npm run get-token-frete e atualize o refresh token.');
    }
    throw new ErroFrete(503, `Melhor Envio recusou a renovação do token (${res.status})`);
  }

  const json = await res.json();
  if (!json.access_token) throw new ErroFrete(503, 'Melhor Envio não devolveu access_token');

  const expiraEm = Date.now() + (Number(json.expires_in) || 3600) * 1000;

  /* Grava os dois juntos: o refresh rotacionado, que sem isto se perde, e o
     access_token, que evita renovar de novo na próxima partida a frio. */
  await credenciais.gravarJson(CHAVE_TOKEN, {
    refresh_token: json.refresh_token || refresh,
    access_token: json.access_token,
    expira_em: expiraEm,
  });

  tokenCache = { valor: json.access_token, expiraEm };
  return tokenCache.valor;
}

/* ==========================================================================
   Cotação
   ========================================================================== */

async function calcular(ambiente, token, corpo) {
  const res = await fetch(`${BASES[ambiente]}/api/v2/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      /* o Melhor Envio exige User-Agent identificando a aplicação */
      'User-Agent': process.env.MELHORENVIO_USER_AGENT || 'VM Click (contato@vmclick.com.br)',
    },
    body: JSON.stringify(corpo),
  });

  if (res.status === 401) {
    throw new ErroFrete(502, 'Token do Melhor Envio recusado (vencido, revogado ou de outro ambiente).');
  }
  /* 403: o token autentica, mas não tem a permissão de cotar. Acontece com
     token gerado sem marcar shipping-calculate. */
  if (res.status === 403) {
    console.error('[frete] 403 do Melhor Envio:', (await res.text()).slice(0, 300));
    throw new ErroFrete(502,
      'Token sem permissão de cotar frete. Gere um novo token marcando a permissão shipping-calculate.');
  }
  if (!res.ok) {
    throw new ErroFrete(502, `Melhor Envio respondeu ${res.status} na cotação`);
  }
  return res.json();
}

/**
 * Para o botão "Testar" do painel: cota uma caixa padrão até a Praça da Sé
 * (SP) com o token daquele ambiente. Valida o que importa - o token tem
 * permissão de cotar - sem precisar de produto nenhum.
 */
async function testarConexao(ambiente, token) {
  const origem = apenasDigitos(process.env.FRETE_CEP_ORIGEM) || '81320450';
  const lista = await calcular(ambiente, token, {
    from: { postal_code: origem },
    to: { postal_code: '01001000' },
    package: { height: PADRAO.altura, width: PADRAO.largura, length: PADRAO.comprimento, weight: PADRAO.peso },
  });
  const servicos = (Array.isArray(lista) ? lista : []).filter((s) => s && !s.error);
  return { servicos: servicos.map((s) => `${(s.company && s.company.name) || ''} ${s.name}`.trim()) };
}

function apenasDigitos(cep) {
  return String(cep || '').replace(/\D/g, '');
}

/**
 * Cota o carrinho para um CEP. Devolve sempre a lista de opções já pronta
 * para a tela, com preço em número e prazo em dias úteis.
 */
async function cotar(cepDestino, itens) {
  const destino = apenasDigitos(cepDestino);
  const origem = apenasDigitos(process.env.FRETE_CEP_ORIGEM);

  if (destino.length !== 8) throw new ErroFrete(400, 'CEP de destino inválido');
  if (origem.length !== 8) throw new ErroFrete(503, 'CEP de origem não configurado no servidor');
  if (!Array.isArray(itens) || !itens.length) throw new ErroFrete(400, 'Carrinho vazio');

  const { pacote, valor, estimado, excede } = montarPacote(itens);

  if (excede) {
    return { opcoes: [], excedeLimite: true, estimado, local: atendeEntregaLocal(destino) };
  }

  const { ambiente, token } = await conexao();
  const corpo = {
    from: { postal_code: origem },
    to: { postal_code: destino },
    package: {
      height: pacote.altura,
      width: pacote.largura,
      length: pacote.comprimento,
      weight: pacote.peso,
    },
    options: { insurance_value: Math.round(valor * 100) / 100, receipt: false, own_hand: false },
  };
  if (process.env.MELHORENVIO_SERVICOS) corpo.services = process.env.MELHORENVIO_SERVICOS;

  const lista = await calcular(ambiente, token, corpo);

  /* A API devolve também os serviços que não atendem, marcados com "error".
     Esses saem da lista: opção que não dá para escolher só confunde.
     custom_price/custom_delivery_time já trazem a margem configurada na
     conta, então são eles que valem, não price/delivery_time. */
  const opcoes = (Array.isArray(lista) ? lista : [])
    .filter((s) => s && !s.error && (s.custom_price || s.price))
    .map((s) => ({
      id: String(s.id),
      transportadora: (s.company && s.company.name) || '',
      servico: s.name || '',
      preco: Number(s.custom_price || s.price),
      prazo: Number(s.custom_delivery_time || s.delivery_time) || null,
    }))
    .sort((a, b) => a.preco - b.preco);

  return { opcoes, excedeLimite: false, estimado, local: atendeEntregaLocal(destino) };
}

/* ==========================================================================
   Modalidades de entrega
   ========================================================================== */

/* Regras de entrega da VM Click (out/2026):
   - transportadoras para qualquer CEP, com o preço e o prazo de cada uma;
   - entrega grátis pela loja só em Curitiba e a partir de R$ 500, em até 3
     dias úteis - quem se encaixa ainda vê as transportadoras pagas;
   - entrega em até 24h não é cotada aqui: o cliente pede pelo WhatsApp;
   - pedido grande demais para transportadora: orçamento pelo WhatsApp.
   A entrega própria paga (R$ 24,90) deixou de existir. */
const FRETE_GRATIS_ACIMA = Number(process.env.FRETE_GRATIS_ACIMA || 500);
const PRAZO_ENTREGA_LOJA = Number(process.env.FRETE_PRAZO_LOJA || 3);

/* Retirada não depende de cotação: vale mesmo com o Melhor Envio fora do ar. */
const OPCAO_RETIRADA = Object.freeze({
  id: 'retirada',
  tipo: 'retirada',
  transportadora: 'VM Click',
  servico: 'Retirar na loja - Portão',
  preco: 0,
  prazo: null,
  detalhe: 'R. Amadeu do Amaral, 1602 · pronto em 2 horas',
});

/**
 * Lista completa do que o cliente pode escolher para aquele CEP: retirada,
 * entrega grátis da loja quando vale, e as transportadoras.
 *
 * Usada pela cotação na tela e de novo na criação do pedido, para o preço do
 * frete cobrado sair daqui e não do navegador.
 */
async function opcoesDeEntrega(cep, itens, subtotal) {
  const r = await cotar(cep, itens);
  const destino = apenasDigitos(cep);
  const curitiba = dentro(destino, CEPS_GRATIS);
  const gratis = curitiba && Number(subtotal) >= FRETE_GRATIS_ACIMA;

  const opcoes = [{ ...OPCAO_RETIRADA }];

  if (gratis) {
    opcoes.push({
      id: 'entrega-local',
      tipo: 'local',
      transportadora: 'VM Click',
      servico: 'Entrega grátis VM Click - Curitiba',
      preco: 0,
      prazo: PRAZO_ENTREGA_LOJA,
      detalhe: `Em até ${PRAZO_ENTREGA_LOJA} dias úteis`,
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

  return {
    opcoes,
    excedeLimite: r.excedeLimite,
    /* Nenhuma transportadora atendeu e o CEP não é da área de entrega própria:
       sobra só a retirada na loja, em Curitiba, que não serve para quem está
       em outro estado. A tela precisa saber disso para oferecer o orçamento
       pelo WhatsApp em vez de fingir que há uma opção. */
    semTransportadora: !r.opcoes.length && !gratis,
    /* CEP onde a loja entrega em até 24h: a tela oferece cotar pelo WhatsApp */
    entregaRapida: r.local,
    /* Curitiba abaixo do piso: quanto falta para a entrega grátis */
    freteGratis: curitiba && !gratis
      ? { acima: FRETE_GRATIS_ACIMA, falta: Math.round((FRETE_GRATIS_ACIMA - Number(subtotal || 0)) * 100) / 100 }
      : null,
    pesoEstimado: r.estimado,
  };
}

/* ==========================================================================
   Chamada genérica (compra de etiqueta)
   ========================================================================== */

/* As mensagens de validação do Melhor Envio vêm em objetos aninhados
   ({ error: { volumes: ["..."] } } ou { errors: { "orders.0": [...] } }). */
function mensagemME(json) {
  if (!json) return '';
  const partes = [];
  const juntar = (v) => {
    if (!v) return;
    if (typeof v === 'string') partes.push(v);
    else if (Array.isArray(v)) v.forEach(juntar);
    else if (typeof v === 'object') Object.values(v).forEach(juntar);
  };
  juntar(json.errors || json.error);
  return partes.length ? partes.join(' ') : (json.message || '');
}

/**
 * Chamada autenticada à API do Melhor Envio, no ambiente e com o token em
 * uso. Para comprar etiqueta o token precisa, além de shipping-calculate,
 * de cart-write, shipping-checkout, shipping-generate, shipping-print e
 * shipping-tracking.
 */
async function chamarME(metodo, caminho, corpo) {
  const { ambiente, token } = await conexao();
  const res = await fetch(`${BASES[ambiente]}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': process.env.MELHORENVIO_USER_AGENT || 'VM Click (contato@vmclick.com.br)',
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(25_000),
  });

  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch (e) { json = null; }

  if (res.status === 401) throw new ErroFrete(502, 'Token do Melhor Envio recusado (vencido, revogado ou de outro ambiente).');
  if (res.status === 403) {
    throw new ErroFrete(502, 'O token do Melhor Envio não tem permissão para comprar etiqueta. Gere um token com cart-write, shipping-checkout, shipping-generate, shipping-print e shipping-tracking e cole no painel.');
  }
  if (!res.ok) {
    console.error(`[frete] ${metodo} ${caminho} -> ${res.status}`, texto.slice(0, 400));
    throw new ErroFrete(res.status === 422 ? 422 : 502, `Melhor Envio recusou: ${mensagemME(json) || res.status}`);
  }
  return { json, ambiente };
}

module.exports = {
  cotar, opcoesDeEntrega, atendeEntregaLocal, catalogo, montarPacote, chamarME,
  testarConexao, OPCAO_RETIRADA, ErroFrete,
};
