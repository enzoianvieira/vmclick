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
 * Variáveis de ambiente (painel da Vercel, nunca no repositório):
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

const CHAVE_TOKEN = 'vmclick:melhorenvio:refresh_token';

const SANDBOX = 'https://sandbox.melhorenvio.com.br';
const PRODUCAO = 'https://melhorenvio.com.br';

function base() {
  return process.env.MELHORENVIO_AMBIENTE === 'producao' ? PRODUCAO : SANDBOX;
}

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

/* Faixas de CEP atendidas pela entrega da própria loja. Curitiba vai de
   80000-000 a 82999-999; a região metropolitana ocupa a faixa 83000-000 a
   83800-999. Dá para sobrescrever em FRETE_CEP_LOCAL, no formato
   "80000000-82999999,83000000-83800999". */
const CEPS_LOCAIS = (process.env.FRETE_CEP_LOCAL || '80000000-82999999,83000000-83800999')
  .split(',')
  .map((faixa) => faixa.split('-').map((n) => parseInt(n.trim(), 10)))
  .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));

function atendeEntregaLocal(cep) {
  const n = parseInt(cep, 10);
  return CEPS_LOCAIS.some(([a, b]) => n >= a && n <= b);
}

/* ==========================================================================
   Token
   ========================================================================== */

let tokenCache = { valor: null, expiraEm: 0 };

async function obterToken() {
  if (tokenCache.valor && Date.now() < tokenCache.expiraEm - 60_000) return tokenCache.valor;

  const { MELHORENVIO_CLIENT_ID, MELHORENVIO_CLIENT_SECRET } = process.env;
  const refresh = await credenciais.lerToken(CHAVE_TOKEN, process.env.MELHORENVIO_REFRESH_TOKEN);

  if (!MELHORENVIO_CLIENT_ID || !MELHORENVIO_CLIENT_SECRET || !refresh) {
    throw new ErroFrete(503, 'Cotação de frete não configurada no servidor');
  }

  const res = await fetch(`${base()}/oauth/token`, {
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
    throw new ErroFrete(503, `Melhor Envio recusou a renovação do token (${res.status})`);
  }

  const json = await res.json();
  if (!json.access_token) throw new ErroFrete(503, 'Melhor Envio não devolveu access_token');

  /* O refresh token rotaciona: sem gravar o novo, a cotação morre quando o
     atual expirar - o mesmo tropeço que já houve com o Olist. */
  if (json.refresh_token && json.refresh_token !== refresh) {
    await credenciais.gravarToken(CHAVE_TOKEN, json.refresh_token);
  }

  tokenCache = {
    valor: json.access_token,
    expiraEm: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  };
  return tokenCache.valor;
}

/* ==========================================================================
   Cotação
   ========================================================================== */

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

  const token = await obterToken();
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

  const res = await fetch(`${base()}/api/v2/me/shipment/calculate`, {
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

  if (!res.ok) {
    throw new ErroFrete(502, `Melhor Envio respondeu ${res.status} na cotação`);
  }

  const lista = await res.json();

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

module.exports = { cotar, atendeEntregaLocal, ErroFrete };
