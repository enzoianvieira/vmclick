/* ==========================================================================
   VM Click - blog
   Índice e bloco "leia também" saem os dois de data/blog.js: publicar um post
   é escrever o HTML e acrescentar uma linha lá. Nada de duplicar metadado.
   No WordPress isto vira o loop de `post` e o arquivo some.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM;

  VM.posts = function () {
    return (window.VM_POSTS || []).slice().sort(function (a, b) {
      return String(b.data).localeCompare(String(a.data));  /* mais recente primeiro */
    });
  };

  VM.post = function (slug) {
    return VM.posts().filter(function (p) { return p.slug === slug; })[0] || null;
  };

  var MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  VM.dataPost = function (iso) {
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    return Number(p[2]) + ' de ' + MESES[Number(p[1]) - 1] + ' de ' + p[0];
  };

  function capaHTML(post, tamanho, sizes) {
    var base = (post.capa && post.capa[tamanho]) || '';
    if (!base) return '';
    return '<picture>' +
      '<source type="image/webp" srcset="' + base + '.webp"' + (sizes ? ' sizes="' + sizes + '"' : '') + '>' +
      '<img src="' + base + '.jpg" alt="' + post.alt.replace(/"/g, '&quot;') + '" loading="lazy" decoding="async">' +
    '</picture>';
  }
  VM.capaPost = capaHTML;

  function cardHTML(post) {
    return '' +
    '<article class="post-card reveal">' +
      '<a class="post-card__link" href="' + post.slug + '">' +
        '<div class="post-card__capa">' + capaHTML(post, 'peq', '(min-width: 900px) 30vw, 92vw') + '</div>' +
        '<div class="post-card__body">' +
          '<span class="post-card__cat">' + post.categoria + '</span>' +
          '<h3>' + post.titulo + '</h3>' +
          '<p>' + post.resumo + '</p>' +
          '<span class="post-card__meta">' +
            '<time datetime="' + post.data + '">' + VM.dataPost(post.data) + '</time>' +
            '<span aria-hidden="true">·</span>' + post.leitura + ' de leitura' +
          '</span>' +
        '</div>' +
      '</a>' +
    '</article>';
  }

  /* Card injetado depois do boot não passou pelo scan inicial das revelações;
     sem isto ficaria parado em opacity 0. */
  function revelar(el) {
    if (window.VMAnim && VMAnim.revelar) VMAnim.revelar(el);
  }

  /* Índice completo (blog.html). */
  VM.renderBlog = function (sel) {
    var el = VM.qs(sel);
    if (!el) return;
    el.innerHTML = VM.posts().map(cardHTML).join('');
    revelar(el);
  };

  /* "Leia também": os outros posts, exceto o que está aberto. */
  VM.renderPostsRelacionados = function (sel, slugAtual, limite) {
    var el = VM.qs(sel);
    if (!el) return;
    var lista = VM.posts().filter(function (p) { return p.slug !== slugAtual; }).slice(0, limite || 2);
    if (!lista.length) {
      var secao = el.closest('section');
      if (secao) secao.hidden = true;
      return;
    }
    el.innerHTML = lista.map(cardHTML).join('');
    revelar(el);
  };
})();
