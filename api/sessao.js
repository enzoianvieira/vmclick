/**
 * POST   /api/sessao  { usuario, senha }  -> entra, devolve cookie de sessão
 * GET    /api/sessao                      -> diz se a sessão está válida
 * DELETE /api/sessao                      -> sai
 */

const {
  NOME_COOKIE, DURACAO_HORAS, senhaConfere, criarToken, lerToken, montarCookie, lerCookie,
} = require('./_sessao.js');

/* Espera entre tentativas erradas, por IP. Não substitui um rate limit de
   verdade, mas tira o custo-benefício de tentar senha na força bruta. */
const tentativas = new Map();
const JANELA_MS = 60_000;
const MAX_TENTATIVAS = 8;

function excedeu(ip) {
  const agora = Date.now();
  const reg = tentativas.get(ip) || { n: 0, desde: agora };
  if (agora - reg.desde > JANELA_MS) { reg.n = 0; reg.desde = agora; }
  reg.n += 1;
  tentativas.set(ip, reg);
  return reg.n > MAX_TENTATIVAS;
}

module.exports = async (req, res) => {
  const segredo = process.env.SESSAO_SEGREDO;
  if (!segredo) return res.status(500).json({ erro: 'SESSAO_SEGREDO não configurado no servidor' });

  if (req.method === 'GET') {
    const sessao = lerToken(lerCookie(req, NOME_COOKIE), segredo);
    return res.status(sessao ? 200 : 401).json(sessao ? { usuario: sessao.u } : { erro: 'sem sessão' });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', montarCookie('', 0));
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ erro: 'método não suportado' });

  const ip = req.headers['x-forwarded-for'] || 'desconhecido';
  if (excedeu(ip)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Espere um minuto antes de tentar de novo.' });
  }

  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const usuario = String(corpo.usuario || '');
  const senha = String(corpo.senha || '');

  /* Erro comum: colar a senha em ADMIN_SENHA_HASH em vez do hash. Sem este
     aviso o servidor recusa todo login com "usuário ou senha incorretos" e não
     há como descobrir o motivo olhando a tela. */
  const hashGuardado = process.env.ADMIN_SENHA_HASH || '';
  const pareceHash = hashGuardado.includes(':') && hashGuardado.length > 100;

  if (!process.env.ADMIN_USUARIO || !hashGuardado) {
    return res.status(500).json({
      erro: 'Painel não configurado no servidor: falta ADMIN_USUARIO ou ADMIN_SENHA_HASH.',
    });
  }
  if (!pareceHash) {
    return res.status(500).json({
      erro: 'ADMIN_SENHA_HASH não é um hash. Parece que a senha foi colada no lugar dele. ' +
            'Gere o valor certo com: node scripts/gerar-senha-admin.js "usuario" "senha"',
    });
  }

  const usuarioOk = usuario === process.env.ADMIN_USUARIO;
  const senhaOk = senhaConfere(senha, hashGuardado);

  /* mensagem única para os dois casos: não entrega se o usuário existe */
  if (!usuarioOk || !senhaOk) {
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }

  res.setHeader('Set-Cookie', montarCookie(criarToken(usuario, segredo), DURACAO_HORAS * 3600));
  return res.status(200).json({ usuario });
};
