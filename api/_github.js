/**
 * VM Click - gravação no repositório
 *
 * POR QUE ISTO EXISTE
 * O site é estático: o conteúdo mora em arquivos do projeto. Para o botão
 * "Publicar" do painel funcionar de verdade, alguém precisa gravar esses
 * arquivos. Quem faz isso é este módulo, pela API do GitHub. Depois do commit
 * a Vercel reconstrói o site sozinha.
 *
 * Assim o dono da loja publica com um clique, sem baixar arquivo e sem abrir
 * terminal.
 *
 * Variáveis de ambiente necessárias:
 *   GITHUB_TOKEN    token com permissão de escrita no repositório
 *   GITHUB_REPO     no formato "usuario/repositorio"
 *   GITHUB_BRANCH   opcional, padrão "main"
 */

const API = 'https://api.github.com';

/* Só estes caminhos podem ser gravados. Sem esta lista, uma falha em outro
   ponto do sistema poderia sobrescrever qualquer arquivo do projeto. */
const PERMITIDOS = new Set([
  'data/produtos.js',
  'data/curadoria.js',
  'data/banners.js',
  'data/blog.js',
  'data/marcas.js',
  'scripts/skus-site.txt',
]);

class ErroGitHub extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

function config() {
  const { GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    throw new ErroGitHub(503, 'Publicação automática ainda não configurada no servidor.');
  }
  return { token: GITHUB_TOKEN, repo: GITHUB_REPO, branch: GITHUB_BRANCH || 'main' };
}

/** Diz se a publicação automática está disponível, sem lançar erro. */
function disponivel() {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

async function chamar(caminho, opcoes) {
  const { token } = config();
  const res = await fetch(API + caminho, Object.assign({
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vmclick-painel',
    },
  }, opcoes || {}));

  if (res.status === 401 || res.status === 403) {
    throw new ErroGitHub(502, 'O token do GitHub não tem permissão para gravar neste repositório.');
  }
  return res;
}

/** Lê um arquivo do repositório. Devolve null se ele ainda não existe. */
async function ler(caminho) {
  const { repo, branch } = config();
  const res = await chamar(`/repos/${repo}/contents/${encodeURI(caminho)}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ErroGitHub(502, `Não consegui ler ${caminho} do repositório.`);

  const json = await res.json();
  return {
    sha: json.sha,
    texto: Buffer.from(json.content || '', 'base64').toString('utf8'),
  };
}

/**
 * Grava (ou cria) um arquivo e devolve o commit.
 * O `sha` do arquivo atual é obrigatório para atualizar: é o que impede
 * sobrescrever, sem perceber, uma alteração feita por outra pessoa.
 */
async function gravar(caminho, texto, mensagem) {
  if (!PERMITIDOS.has(caminho)) {
    throw new ErroGitHub(400, `Caminho não permitido: ${caminho}`);
  }
  const { repo, branch } = config();
  const atual = await ler(caminho);

  const corpo = {
    message: mensagem,
    content: Buffer.from(texto, 'utf8').toString('base64'),
    branch,
  };
  if (atual) corpo.sha = atual.sha;

  const res = await chamar(`/repos/${repo}/contents/${encodeURI(caminho)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  if (res.status === 409) {
    throw new ErroGitHub(409, 'O arquivo mudou no repositório enquanto você editava. Recarregue o painel e publique de novo.');
  }
  if (!res.ok) {
    const detalhe = await res.text();
    throw new ErroGitHub(502, `Falha ao gravar ${caminho}: ${detalhe.slice(0, 160)}`);
  }

  const json = await res.json();
  return { caminho, commit: json.commit && json.commit.sha };
}

module.exports = { ler, gravar, disponivel, ErroGitHub, PERMITIDOS };
