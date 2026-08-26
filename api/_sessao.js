/**
 * VM Click - sessão do painel administrativo
 *
 * COMO A AUTENTICAÇÃO FUNCIONA
 * A senha do admin nunca é comparada no navegador. O navegador manda a senha
 * uma vez, o servidor confere contra o hash guardado em variável de ambiente e
 * devolve um cookie de sessão assinado, httpOnly (o JavaScript da página não
 * consegue ler) e sameSite (não viaja para outros sites).
 *
 * Variáveis de ambiente necessárias:
 *   ADMIN_USUARIO       nome de usuário
 *   ADMIN_SENHA_HASH    hash scrypt da senha, no formato "sal:hash"
 *   SESSAO_SEGREDO      string aleatória longa, assina o cookie
 *
 * Para gerar o hash da senha:
 *   node scripts/gerar-senha-admin.js
 */

const crypto = require('crypto');

const NOME_COOKIE = 'vmc_sessao';
const DURACAO_HORAS = 8;

/* ---------------------------------------------------------------- senha ---- */

/** Gera "sal:hash" para guardar em ADMIN_SENHA_HASH. */
function gerarHash(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

/** Confere a senha contra o hash, em tempo constante. */
function senhaConfere(senha, guardado) {
  if (!guardado || !guardado.includes(':')) return false;
  const [sal, hashEsperado] = guardado.split(':');
  const hashRecebido = crypto.scryptSync(senha, sal, 64);
  const esperado = Buffer.from(hashEsperado, 'hex');
  if (esperado.length !== hashRecebido.length) return false;
  /* timingSafeEqual evita descobrir a senha medindo o tempo de resposta */
  return crypto.timingSafeEqual(esperado, hashRecebido);
}

/* --------------------------------------------------------------- cookie ---- */

function assinar(carga, segredo) {
  return crypto.createHmac('sha256', segredo).update(carga).digest('base64url');
}

function criarToken(usuario, segredo) {
  const expira = Date.now() + DURACAO_HORAS * 3600 * 1000;
  const carga = Buffer.from(JSON.stringify({ u: usuario, exp: expira })).toString('base64url');
  return `${carga}.${assinar(carga, segredo)}`;
}

function lerToken(token, segredo) {
  if (!token || !token.includes('.')) return null;
  const [carga, assinatura] = token.split('.');
  const esperada = assinar(carga, segredo);
  /* compara a assinatura antes de confiar no conteúdo */
  if (assinatura.length !== esperada.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;
  try {
    const dados = JSON.parse(Buffer.from(carga, 'base64url').toString());
    if (!dados.exp || Date.now() > dados.exp) return null;
    return dados;
  } catch {
    return null;
  }
}

function montarCookie(valor, maxIdadeSegundos) {
  const partes = [
    `${NOME_COOKIE}=${valor}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxIdadeSegundos}`,
  ];
  /* em produção o cookie só trafega por HTTPS */
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development') partes.push('Secure');
  return partes.join('; ');
}

function lerCookie(req, nome) {
  const bruto = req.headers.cookie || '';
  for (const parte of bruto.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return v.join('=');
  }
  return null;
}

/* ------------------------------------------------------------- proteção ---- */

/**
 * Envolve um handler e só deixa passar quem tem sessão válida.
 * Uso: module.exports = protegido(async (req, res) => { ... });
 */
function protegido(handler) {
  return async (req, res) => {
    const segredo = process.env.SESSAO_SEGREDO;
    if (!segredo) {
      return res.status(500).json({ erro: 'SESSAO_SEGREDO não configurado no servidor' });
    }
    const sessao = lerToken(lerCookie(req, NOME_COOKIE), segredo);
    if (!sessao) {
      return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' });
    }
    req.sessao = sessao;
    return handler(req, res);
  };
}

module.exports = {
  NOME_COOKIE,
  DURACAO_HORAS,
  gerarHash,
  senhaConfere,
  criarToken,
  lerToken,
  montarCookie,
  lerCookie,
  protegido,
};
