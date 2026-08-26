/* ==========================================================================
   VM Click - painel: conversa com o servidor

   Toda chamada ao Olist passa pelos endpoints deste projeto. O navegador nunca
   vê o token do ERP: ele fica em variável de ambiente no servidor.

   Sessão expirada devolve 401 em qualquer chamada, e aí o painel manda de
   volta para o login em vez de mostrar tela quebrada.
   ========================================================================== */
window.API = (function () {
  'use strict';

  function paraLogin() {
    if (!/\/admin\/index\.html?$/.test(location.pathname)) location.replace('index.html');
  }

  async function pedir(caminho, opcoes) {
    var res;
    try {
      res = await fetch(caminho, Object.assign({
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      }, opcoes || {}));
    } catch (e) {
      throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.');
    }

    if (res.status === 401) {
      paraLogin();
      throw new Error('Sessão expirada. Entre de novo.');
    }

    var corpo = null;
    try { corpo = await res.json(); } catch (e) { corpo = null; }

    if (!res.ok) {
      throw new Error((corpo && corpo.erro) || 'Erro ' + res.status + ' ao falar com o servidor.');
    }
    return corpo;
  }

  return {
    /* ---------------------------------------------------------- sessão --- */
    async sessao() {
      try {
        var res = await fetch('/api/sessao', { credentials: 'same-origin' });
        return res.ok ? res.json() : null;
      } catch (e) { return null; }
    },

    entrar(usuario, senha) {
      return pedir('/api/sessao', {
        method: 'POST',
        body: JSON.stringify({ usuario: usuario, senha: senha }),
      });
    },

    sair() {
      return pedir('/api/sessao', { method: 'DELETE' });
    },

    /* ---------------------------------------------------------- Olist ---- */
    buscarProdutos(termo, pagina) {
      var p = new URLSearchParams({ q: termo || '', pagina: String(pagina || 0) });
      return pedir('/api/produtos/buscar?' + p.toString());
    },

    publicar(carga) {
      return pedir('/api/publicar', { method: 'POST', body: JSON.stringify(carga) });
    },

    publicacaoConfigurada() {
      return pedir('/api/publicar').then(function (r) { return r.configurado; });
    },

    detalheProduto(id) {
      return pedir('/api/produtos/detalhe?id=' + encodeURIComponent(id));
    },
  };
})();
