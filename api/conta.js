/**
 * /api/conta - "Minha conta" do cliente, sem senha
 *
 *   POST { acao: "codigo", email }          -> manda um código de 6 dígitos
 *   POST { acao: "entrar", email, codigo }  -> confere e abre a sessão
 *   GET                                     -> e-mail da sessão e os pedidos
 *   DELETE                                  -> sai
 *
 * Os pedidos são encontrados pelo e-mail usado na compra: quem comprou sem
 * conta entra depois e vê tudo.
 *
 * SEGURANÇA
 * - O código vale 10 minutos e 5 tentativas; guardado só como hash.
 * - A resposta ao pedir código é sempre a mesma, exista pedido ou não: não
 *   dá para descobrir quem é cliente testando e-mails.
 * - Teto de pedidos de código por e-mail e por IP: e-mail custa e incomoda.
 * - O cookie da conta é assinado com uma chave DERIVADA de SESSAO_SEGREDO,
 *   diferente da do painel: um cookie de cliente nunca vale como sessão de
 *   administrador, nem o contrário.
 */

const crypto = require('crypto');

const armazem = require('./_armazem.js');
const pedidos = require('./_pedido.js');
const email = require('./_email.js');

const COOKIE = 'vmc_conta';
const DURACAO_DIAS = 30;
const CODIGO_VALIDADE_S = 600;
const MAX_TENTATIVAS = 5;
const CODIGOS_POR_HORA_EMAIL = 5;
const CODIGOS_POR_HORA_IP = 15;

class ErroConta extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}

function ipDe(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || (req.socket && req.socket.remoteAddress) || 'desconhecido';
}

function normalizarEmail(v) {
  const e = String(v || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) throw new ErroConta(400, 'Informe um e-mail válido.');
  return e;
}

const hash = (texto) => crypto.createHash('sha256').update(texto).digest('hex');
const chaveCodigo = (e) => `vmclick:conta:codigo:${hash(e).slice(0, 32)}`;

/* ------------------------------------------------------------ sessão ---- */

function chaveAssinatura() {
  const segredo = process.env.SESSAO_SEGREDO;
  if (!segredo) throw new ErroConta(500, 'SESSAO_SEGREDO não configurado no servidor');
  return Buffer.from(crypto.hkdfSync('sha256', segredo, 'vmclick', 'conta-cliente-v1', 32));
}

function assinar(carga) {
  return crypto.createHmac('sha256', chaveAssinatura()).update(carga).digest('base64url');
}

function criarCookie(emailCliente) {
  const carga = Buffer.from(JSON.stringify({ c: emailCliente, exp: Date.now() + DURACAO_DIAS * 86400000 })).toString('base64url');
  return `${carga}.${assinar(carga)}`;
}

function lerSessao(req) {
  const bruto = String(req.headers.cookie || '');
  let token = null;
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) token = v.join('=');
  }
  if (!token || !token.includes('.')) return null;
  const [carga, assinatura] = token.split('.');
  const esperada = assinar(carga);
  if (assinatura.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;
  try {
    const d = JSON.parse(Buffer.from(carga, 'base64url').toString());
    return d.c && d.exp > Date.now() ? d.c : null;
  } catch (e) { return null; }
}

function montarCookie(valor, maxIdade) {
  /* Lax, não Strict: o cliente chega pelo link do e-mail e precisa estar logado */
  const partes = [`${COOKIE}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxIdade}`];
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development') partes.push('Secure');
  return partes.join('; ');
}

/* ------------------------------------------------------------ ações ----- */

async function pedirCodigo(req, corpo) {
  const e = normalizarEmail(corpo.email);

  const porIp = await armazem.incrementar(`vmclick:limite:conta-ip:${ipDe(req)}`, 3600);
  const porEmail = await armazem.incrementar(`vmclick:limite:conta-email:${hash(e).slice(0, 32)}`, 3600);
  if (porIp > CODIGOS_POR_HORA_IP || porEmail > CODIGOS_POR_HORA_EMAIL) {
    throw new ErroConta(429, 'Muitos códigos pedidos. Espere um pouco e tente de novo.');
  }

  const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await armazem.gravar(chaveCodigo(e), {
    h: hash(`${codigo}:${e}`),
    tentativas: 0,
    expira: Date.now() + CODIGO_VALIDADE_S * 1000,
  }, CODIGO_VALIDADE_S);

  try {
    await email.codigoAcesso(e, codigo);
  } catch (err) {
    throw new ErroConta(503, 'Não conseguimos enviar o e-mail agora. Tente de novo em instantes.');
  }
  return { ok: true };
}

async function entrar(req, res, corpo) {
  const e = normalizarEmail(corpo.email);
  const codigo = String(corpo.codigo || '').replace(/\D/g, '');
  const chave = chaveCodigo(e);
  const guardado = await armazem.ler(chave);

  if (!guardado || guardado.expira < Date.now()) {
    throw new ErroConta(400, 'Código expirado. Peça um novo.');
  }
  if (guardado.tentativas >= MAX_TENTATIVAS) {
    await armazem.apagar(chave);
    throw new ErroConta(429, 'Tentativas esgotadas. Peça um novo código.');
  }

  const a = Buffer.from(hash(`${codigo}:${e}`));
  const b = Buffer.from(guardado.h);
  if (codigo.length !== 6 || !crypto.timingSafeEqual(a, b)) {
    guardado.tentativas += 1;
    const resta = Math.max(1, Math.ceil((guardado.expira - Date.now()) / 1000));
    await armazem.gravar(chave, guardado, resta);
    const sobram = MAX_TENTATIVAS - guardado.tentativas;
    throw new ErroConta(400, sobram > 0 ? `Código incorreto. ${sobram} tentativa(s) restante(s).` : 'Código incorreto. Peça um novo.');
  }

  await armazem.apagar(chave);
  res.setHeader('Set-Cookie', montarCookie(criarCookie(e), DURACAO_DIAS * 86400));
  return { ok: true, email: e };
}

async function minhaConta(e) {
  const lista = await pedidos.doCliente(e, 50);
  return {
    email: e,
    /* só pedidos que chegaram a existir para o cliente: sem os que falharam
       antes de gerar cobrança */
    pedidos: lista
      .filter((p) => p.status !== 'falhou')
      .map((p) => Object.assign({ id: p.id }, pedidos.visaoPublica(p))),
  };
}

/* ----------------------------------------------------------- handler ---- */

module.exports = async (req, res) => {
  try {
    if (!armazem.disponivel()) throw new ErroConta(503, 'Conta indisponível no momento.');

    if (req.method === 'GET') {
      const e = lerSessao(req);
      if (!e) return res.status(401).json({ erro: 'Entre com seu e-mail.' });
      return res.status(200).json(await minhaConta(e));
    }

    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', montarCookie('', 0));
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST') {
      const corpo = lerCorpo(req);
      if (corpo.acao === 'codigo') return res.status(200).json(await pedirCodigo(req, corpo));
      if (corpo.acao === 'entrar') return res.status(200).json(await entrar(req, res, corpo));
      throw new ErroConta(400, 'Ação desconhecida.');
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ erro: 'Método não suportado.' });
  } catch (e) {
    if (e instanceof ErroConta) return res.status(e.status).json({ erro: e.message });
    console.error('[conta] falha:', e);
    return res.status(500).json({ erro: 'Não foi possível concluir agora.' });
  }
};
