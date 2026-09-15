/**
 * GET /api/callback-melhorenvio
 *
 * Página de retorno da autorização do Melhor Envio.
 *
 * POR QUE ISTO EXISTE
 * O Melhor Envio só aceita URL de redirecionamento em https, então o servidor
 * local do script de token (http://localhost) não serve. A autorização volta
 * para cá, esta página mostra o código, e você cola no terminal.
 *
 * O código sozinho não dá acesso a nada: ele é de uso único, dura poucos
 * minutos e só vira token com o client_secret, que nunca sai do servidor.
 */

/* O code e o state voltam pela query string, ou seja, são texto de fora.
   Escapados antes de entrar no HTML - texto de terceiro nunca vai cru pra
   dentro da página. */
function escapar(texto) {
  return String(texto == null ? '' : texto).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function pagina({ titulo, corpo }) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} | VM Click</title>
<style>
  :root { color-scheme: light; }
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif;
         margin: 0; padding: 2rem 1rem; background: #F6F8F7; color: #10201D; }
  main { max-width: 640px; margin-inline: auto; background: #fff;
         border: 1px solid #DCE5E2; border-radius: 14px; padding: 2rem; }
  h1 { font-size: 1.3rem; margin: 0 0 .25rem; }
  p  { color: #52635F; line-height: 1.6; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  pre { background: #10201D; color: #EAF3F0; padding: 1rem; border-radius: 10px;
        overflow-x: auto; user-select: all; font-size: .9rem; }
  .rotulo { font-size: .72rem; letter-spacing: .08em; text-transform: uppercase;
            color: #52635F; margin-bottom: .4rem; font-weight: 600; }
  .erro { color: #B3261E; font-weight: 600; }
  .nota { font-size: .85rem; color: #52635F; border-top: 1px solid #DCE5E2;
          margin-top: 1.5rem; padding-top: 1rem; }
</style></head>
<body><main>${corpo}</main></body></html>`;
}

module.exports = (req, res) => {
  const url = new URL(req.url, 'http://local');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const erro = url.searchParams.get('error');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  /* não é pra ficar em cache nem ser indexado: é página de uso único */
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (erro) {
    return res.status(400).send(pagina({
      titulo: 'Erro na autorização',
      corpo: `<h1 class="erro">A autorização falhou</h1>
        <p><b>${escapar(erro)}</b><br>${escapar(url.searchParams.get('error_description') || '')}</p>
        <p>Rode <code>npm run get-token-frete</code> de novo.</p>`,
    }));
  }

  if (!code) {
    return res.status(400).send(pagina({
      titulo: 'Sem código',
      corpo: `<h1 class="erro">Faltou o código</h1>
        <p>Esta página só funciona como retorno da autorização do Melhor Envio.
        Comece pelo terminal, com <code>npm run get-token-frete</code>.</p>`,
    }));
  }

  return res.status(200).send(pagina({
    titulo: 'Autorização recebida',
    corpo: `<h1>Autorização recebida ✓</h1>
      <p>Copie o código abaixo e cole no terminal, onde o script está esperando.</p>
      <div class="rotulo">Código de autorização</div>
      <pre id="code">${escapar(code)}</pre>
      <div class="rotulo">State</div>
      <pre>${escapar(state)}</pre>
      <p class="nota">Confira que o <i>state</i> acima é o mesmo que o terminal
      mostrou antes de abrir o navegador. Se for diferente, cancele e comece de
      novo — a resposta pode não ter vindo do seu pedido.<br><br>
      O código expira em poucos minutos e só pode ser usado uma vez.</p>`,
  }));
};
