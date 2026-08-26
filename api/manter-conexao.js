/**
 * GET /api/manter-conexao
 *
 * POR QUE ISTO EXISTE
 * O refresh token do Olist é do tipo Offline, rotaciona a cada uso e vale
 * 1 dia — mas cada renovação carimba mais 1 dia. Ou seja: a conexão só morre
 * se ninguém usar o painel por mais de 24 horas.
 *
 * Este endpoint renova a credencial de propósito. Chamado por agendamento duas
 * vezes ao dia, mantém a conexão viva para sempre, mesmo numa semana em que
 * ninguém abrir o painel. Sem ele, voltar de um feriado significaria reautorizar
 * o Olist no navegador antes de conseguir publicar qualquer coisa.
 *
 * Proteção: a Vercel envia `Authorization: Bearer $CRON_SECRET` nos
 * agendamentos. Sem esse cabeçalho o endpoint recusa, para não virar um jeito
 * de qualquer um forçar renovações.
 */

const { olistGet, ErroOlist } = require('./_olist.js');
const { lerRefreshToken, armazenamentoDisponivel } = require('./_credenciais.js');

function autorizado(req) {
  const segredo = process.env.CRON_SECRET;
  /* sem segredo configurado, só aceita em desenvolvimento */
  if (!segredo) return !process.env.VERCEL;
  return (req.headers.authorization || '') === `Bearer ${segredo}`;
}

function validadeDe(token) {
  try {
    const carga = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64').toString());
    return carga.exp ? new Date(carga.exp * 1000).toISOString() : 'sem prazo';
  } catch {
    return 'desconhecida';
  }
}

module.exports = async (req, res) => {
  if (!autorizado(req)) {
    return res.status(401).json({ erro: 'não autorizado' });
  }

  try {
    /* uma chamada barata: o que importa é passar pela renovação do token */
    await olistGet('/produtos?limit=1');

    const atual = await lerRefreshToken();
    return res.status(200).json({
      ok: true,
      renovadoEm: new Date().toISOString(),
      validoAte: validadeDe(atual),
      guardado: armazenamentoDisponivel(),
    });
  } catch (err) {
    const status = err instanceof ErroOlist ? err.status : 500;
    /* devolve erro de verdade para o agendamento aparecer como falho no painel
       da Vercel, em vez de falhar em silêncio */
    return res.status(status).json({ erro: err.message });
  }
};
