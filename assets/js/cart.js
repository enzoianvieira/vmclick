/* ==========================================================================
   VM Click - carrinho (estado local)
   MVP: o carrinho vive em localStorage. Na fase 2 este módulo é substituído
   pelo carrinho do WooCommerce (sessão + AJAX add_to_cart).
   ========================================================================== */
(function () {
  'use strict';

  var CHAVE = 'vm_carrinho_v1';
  var FRETE_GRATIS = 299;
  var FRETE_PADRAO = 24.90;

  var Cart = window.VMCart = {};

  /* ---------------------------------------------------------------- estado */
  function ler() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || []; }
    catch (e) { return []; }
  }
  function gravar(itens) {
    localStorage.setItem(CHAVE, JSON.stringify(itens));
    Cart.itens = itens;
    atualizarTudo();
  }

  Cart.itens = ler();

  Cart.produto = function (slug) {
    return (window.VM_PRODUTOS || []).filter(function (p) { return p.slug === slug; })[0] || null;
  };

  Cart.linhas = function () {
    return Cart.itens.map(function (i) {
      var p = Cart.produto(i.slug);
      if (!p) return null;
      return { p: p, qtd: i.qtd, sub: p.preco * i.qtd };
    }).filter(Boolean);
  };

  Cart.subtotal = function () {
    return Cart.linhas().reduce(function (s, l) { return s + l.sub; }, 0);
  };
  Cart.quantidade = function () {
    return Cart.itens.reduce(function (s, i) { return s + i.qtd; }, 0);
  };
  Cart.frete = function () {
    var sub = Cart.subtotal();
    if (sub === 0) return 0;
    return sub >= FRETE_GRATIS ? 0 : FRETE_PADRAO;
  };
  Cart.total = function () { return Cart.subtotal() + Cart.frete(); };
  Cart.faltaFreteGratis = function () { return Math.max(0, FRETE_GRATIS - Cart.subtotal()); };

  /* ---------------------------------------------------------------- ações */
  Cart.adicionar = function (slug, qtd) {
    qtd = qtd || 1;
    var p = Cart.produto(slug);
    if (!p) return;
    if (p.estoque <= 0) { window.VM.toast('Produto sem estoque no momento.', 'warn'); return; }

    var itens = ler();
    var achou = itens.filter(function (i) { return i.slug === slug; })[0];
    if (achou) achou.qtd = Math.min(achou.qtd + qtd, p.estoque);
    else itens.push({ slug: slug, qtd: Math.min(qtd, p.estoque) });

    gravar(itens);
    window.VM.toast(p.nome + ' adicionado ao carrinho.');
    Cart.abrir();
  };

  Cart.definirQtd = function (slug, qtd) {
    var p = Cart.produto(slug);
    var itens = ler().map(function (i) {
      if (i.slug !== slug) return i;
      i.qtd = Math.max(1, Math.min(qtd, p ? p.estoque : 99));
      return i;
    });
    gravar(itens);
  };

  Cart.remover = function (slug) {
    gravar(ler().filter(function (i) { return i.slug !== slug; }));
    window.VM.toast('Item removido do carrinho.', 'warn');
  };

  Cart.limpar = function () { gravar([]); };

  /* --------------------------------------------------------------- drawer */
  function drawerHTML() {
    return '' +
    '<div class="overlay" data-fechar-carrinho></div>' +
    '<div class="cart-drawer__panel" role="dialog" aria-modal="true" aria-label="Carrinho de compras">' +
      '<div class="cart-drawer__head">' +
        '<h3>Seu carrinho</h3>' +
        '<button class="btn-icon" data-fechar-carrinho aria-label="Fechar carrinho">' + window.VM.icon('fechar') + '</button>' +
      '</div>' +
      '<div class="cart-drawer__body" id="cart-drawer-body"></div>' +
      '<div class="cart-drawer__foot" id="cart-drawer-foot"></div>' +
    '</div>';
  }

  function linhaHTML(l) {
    return '' +
    '<div class="cart-line" data-slug="' + l.p.slug + '">' +
      '<div class="cart-line__thumb">' + window.VM.ico(l.p.icone) + '</div>' +
      '<div class="cart-line__info">' +
        '<a class="cart-line__name" href="produto.html?p=' + l.p.slug + '">' + l.p.nome + '</a>' +
        '<span class="cart-line__meta">' + l.p.marca + ' · cód. ' + l.p.sku + '</span>' +
        '<div class="cart-line__bottom">' +
          '<div class="qty qty--mini">' +
            '<button type="button" data-menos aria-label="Diminuir quantidade">−</button>' +
            '<input type="number" value="' + l.qtd + '" min="1" max="' + l.p.estoque + '" aria-label="Quantidade">' +
            '<button type="button" data-mais aria-label="Aumentar quantidade">+</button>' +
          '</div>' +
          '<span class="cart-line__price">' + window.VM.money(l.sub) + '</span>' +
        '</div>' +
        '<button class="cart-line__rm" data-remover>Remover</button>' +
      '</div>' +
    '</div>';
  }

  function renderDrawer() {
    var body = document.getElementById('cart-drawer-body');
    var foot = document.getElementById('cart-drawer-foot');
    if (!body || !foot) return;

    var linhas = Cart.linhas();

    if (!linhas.length) {
      body.innerHTML =
        '<div class="empty-state" style="border:0;background:none;padding:48px 0">' +
          window.VM.icon('carrinho') +
          '<h4 style="margin-bottom:8px">Seu carrinho está vazio</h4>' +
          '<p class="muted" style="font-size:14px">Explore o catálogo e adicione os itens da sua obra.</p>' +
          '<a class="btn btn--secondary" style="margin-top:20px" href="produtos.html">Ver produtos</a>' +
        '</div>';
      foot.innerHTML = '';
      return;
    }

    body.innerHTML = linhas.map(linhaHTML).join('');

    var falta = Cart.faltaFreteGratis();
    var aviso = falta > 0
      ? '<p style="font-size:13px;color:var(--text-muted)">Faltam <b>' + window.VM.money(falta) + '</b> para frete grátis.</p>'
      : '<p style="font-size:13px;color:var(--success);font-weight:600">Você ganhou frete grátis.</p>';

    foot.innerHTML =
      aviso +
      '<div class="cart-total"><span class="t">Subtotal (' + Cart.quantidade() + ' itens)</span>' +
      '<span class="v">' + window.VM.money(Cart.subtotal()) + '</span></div>' +
      '<a class="btn btn--primary btn--block" href="finalizar.html">Finalizar compra</a>' +
      '<a class="btn btn--ghost btn--block" href="carrinho.html">Ver carrinho completo</a>';
  }

  Cart.abrir = function () {
    var d = document.getElementById('cart-drawer');
    renderDrawer();
    window.VM.abrirDrawer(d);
  };
  Cart.fechar = function () {
    window.VM.fecharDrawer(document.getElementById('cart-drawer'));
  };

  /* --------------------------------------------------- atualizações globais */
  function atualizarTudo() {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      var n = Cart.quantidade();
      el.textContent = n;
      el.setAttribute('data-count', n);
    });
    renderDrawer();
    document.dispatchEvent(new CustomEvent('vm:cart'));
  }

  /* ------------------------------------------------------------------ init */
  Cart.init = function () {
    if (!document.getElementById('cart-drawer')) {
      var d = document.createElement('div');
      d.className = 'cart-drawer';
      d.id = 'cart-drawer';
      d.innerHTML = drawerHTML();
      document.body.appendChild(d);
    }

    var abrir = document.getElementById('abrir-carrinho');
    if (abrir) abrir.addEventListener('click', Cart.abrir);

    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-fechar-carrinho]')) { Cart.fechar(); return; }

      var addBtn = e.target.closest('[data-add]');
      if (addBtn) {
        e.preventDefault();
        var qtdInput = document.getElementById('pdp-qtd');
        var q = qtdInput ? parseInt(qtdInput.value, 10) || 1 : 1;
        Cart.adicionar(addBtn.getAttribute('data-add'), addBtn.hasAttribute('data-usa-qtd') ? q : 1);
        return;
      }

      var comprar = e.target.closest('[data-comprar]');
      if (comprar) {
        e.preventDefault();
        var qi = document.getElementById('pdp-qtd');
        Cart.adicionar(comprar.getAttribute('data-comprar'), qi ? parseInt(qi.value, 10) || 1 : 1);
        setTimeout(function () { window.location.href = 'finalizar.html'; }, 500);
        return;
      }

      var linha = e.target.closest('[data-slug]');
      if (!linha) return;
      var slug = linha.getAttribute('data-slug');
      var atual = (Cart.itens.filter(function (i) { return i.slug === slug; })[0] || {}).qtd || 1;

      if (e.target.closest('[data-remover]')) { Cart.remover(slug); }
      else if (e.target.closest('[data-mais]'))  { Cart.definirQtd(slug, atual + 1); }
      else if (e.target.closest('[data-menos]')) { Cart.definirQtd(slug, atual - 1); }
    });

    document.addEventListener('change', function (e) {
      var input = e.target;
      if (input.tagName !== 'INPUT' || input.type !== 'number') return;
      var linha = input.closest('[data-slug]');
      if (!linha) return;
      Cart.definirQtd(linha.getAttribute('data-slug'), parseInt(input.value, 10) || 1);
    });

    atualizarTudo();
  };

  Cart.FRETE_GRATIS = FRETE_GRATIS;
  Cart.FRETE_PADRAO = FRETE_PADRAO;
})();

