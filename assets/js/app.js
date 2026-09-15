/* ==========================================================================
   VM Click - núcleo da aplicação
   Header, rodapé, busca, drawers, toasts e utilitários compartilhados.
   No WordPress, header/rodapé viram get_header()/get_footer(); aqui são
   injetados por JS para existir uma única fonte de verdade.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM = window.VM || {};

  /* ======================================================================
     1. UTILITÁRIOS
     ====================================================================== */
  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  VM.money = function (v) { return BRL.format(v || 0); };

  VM.parcelas = function (preco) {
    if (preco >= 150) return { n: 6, v: preco / 6 };
    if (preco >= 99)  return { n: 3, v: preco / 3 };
    return null;
  };

  VM.pix = function (preco) { return preco * 0.95; };

  VM.qs  = function (s, r) { return (r || document).querySelector(s); };
  VM.qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  VM.param = function (name) {
    return new URLSearchParams(window.location.search).get(name);
  };

  VM.slugify = function (s) {
    return String(s).toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  VM.produtos = function () { return window.VM_PRODUTOS || []; };
  VM.categorias = function () { return window.VM_CATEGORIAS || []; };

  /* Quantos produtos existem em cada categoria. */
  VM.contarPorCategoria = function (slug) {
    return VM.produtos().filter(function (p) { return p.cat === slug; }).length;
  };

  /* Categorias que de fato têm produto. O catálogo do site é um recorte do
     Olist, então categoria vazia não deve aparecer no menu, no rodapé nem na
     home: leva o cliente para uma vitrine sem nada. */
  VM.categoriasAtivas = function () {
    return VM.categorias().filter(function (c) { return VM.contarPorCategoria(c.slug) > 0; });
  };
  VM.categoria = function (slug) {
    return VM.categorias().filter(function (c) { return c.slug === slug; })[0] || null;
  };
  VM.produto = function (slug) {
    return VM.produtos().filter(function (p) { return p.slug === slug; })[0] || null;
  };

  /* ======================================================================
     2. ÍCONES DE INTERFACE
     ====================================================================== */
  var P = {
    busca:      '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    carrinho:   '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>',
    menu:       '<path d="M3 6h18M3 12h18M3 18h18"/>',
    fechar:     '<path d="M6 6l12 12M18 6L6 18"/>',
    telefone:   '<path d="M22 16.9v2a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 3.2 2 2 0 0 1 4.1 1h2a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.1 8.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    email:      '<rect x="2.5" y="4.5" width="19" height="15" rx="2"/><path d="m3 6 9 7 9-7"/>',
    local:      '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.8"/>',
    relogio:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    /* whatsapp não entra aqui: é marca de terceiro e vem do sprite (#m-whatsapp),
       com o contorno oficial. Ver VM.icon abaixo. */
    instagram:  '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1"/>',
    facebook:   '<path d="M14.5 8.5h2.5V5.2h-2.6c-2.4 0-3.9 1.5-3.9 4v2H8v3.3h2.5V21h3.4v-6.5h2.5l.5-3.3h-3V9.4c0-.6.2-.9 1.1-.9Z"/>',
    seta:       '<path d="M5 12h13M13 6l6 6-6 6"/>',
    chevron:    '<path d="m9 6 6 6-6 6"/>',
    chevronB:   '<path d="m6 9 6 6 6-6"/>',
    check:      '<path d="m4 12.5 5 5L20 6.5"/>',
    checkCirc:  '<circle cx="12" cy="12" r="9"/><path d="m8 12.2 2.7 2.8L16 9.5"/>',
    estrela:    '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9Z" fill="currentColor" stroke="none"/>',
    coracao:    '<path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.5a4.4 4.4 0 0 1 7.5 2.9C19.5 15.4 12 20 12 20Z"/>',
    caminhao:   '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18.5" r="1.6"/><circle cx="17.5" cy="18.5" r="1.6"/>',
    escudo:     '<path d="M12 3 5 6v6c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6Z"/><path d="m9 12 2 2 4-4"/>',
    filtro:     '<path d="M4 6h16M7 12h10M10 18h4"/>',
    mais:       '<path d="M12 5v14M5 12h14"/>',
    menos:      '<path d="M5 12h14"/>',
    info:       '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    caixa:      '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
    atendente:  '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4" height="6" rx="1.6"/><rect x="17.5" y="13" width="4" height="6" rx="1.6"/><path d="M19.5 19v.6a2.4 2.4 0 0 1-2.4 2.4H13"/>',
    cartao:     '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6 15h3"/>',
    pix:        '<path d="m12 3 4.5 4.5L12 12 7.5 7.5 12 3ZM12 12l4.5 4.5L12 21l-4.5-4.5L12 12ZM3 12l4.5-4.5v9L3 12ZM21 12l-4.5 4.5v-9L21 12Z"/>',
    boleto:     '<path d="M4 5v14M7 5v14M10 5v14M13.5 5v14M17 5v14M20 5v14"/>',
    alerta:     '<path d="M12 4 2.8 20h18.4L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
    raio:       '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
    regua:      '<rect x="2.5" y="8.5" width="19" height="7" rx="1.5"/><path d="M7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v4"/>',
    loja:       '<path d="M4 9h16v11H4zM3 9l1.6-5h14.8L21 9"/><path d="M9 20v-6h6v6"/>',
    doc:        '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'
  };

  /* Marcas de terceiros são símbolos sólidos do sprite; o resto são os
     pictogramas traçados de P. A assinatura da função é a mesma para os dois. */
  var MARCAS = { whatsapp: 'm-whatsapp' };

  VM.icon = function (name, cls) {
    if (MARCAS[name]) {
      return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
             '<use href="#' + MARCAS[name] + '"></use></svg>';
    }
    var d = P[name] || '';
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
           'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };

  VM.ico = function (id, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  };

  /* ======================================================================
     3. DADOS DA EMPRESA
     ====================================================================== */
  var EMPRESA = VM.EMPRESA = {
    nome: 'VM Click',
    assinatura: 'Materiais elétricos, hidráulicos e utilidades',
    cnpj: '17.502.553/0001-45',
    email: 'contato@vmclick.com.br',
    fone: '(41) 3089-2453',
    cel: '(41) 99892-0006',
    endereco: 'R. Amadeu do Amaral, 1602 - Portão, Curitiba/PR',
    horario: 'Segunda a sexta, 08:00 às 18:00 · Sábado, 08:00 às 13:00',
    whatsapp: 'https://api.whatsapp.com/send?phone=5541998920006&text=Vim%20do%20site%20e%20gostaria%20de%20um%20or%C3%A7amento',
    instagram: 'https://www.instagram.com/vmclick',
    facebook: 'https://pt-br.facebook.com/vmclick/',
    desde: 2012
  };

  /* Logo oficial em duas versões do mesmo lockup: a assinatura é preta na
     variante clara e branca na escura, então cada fundo pede a sua. */
  var LOGO_ALT = 'VM Click - materiais elétricos, hidráulicos e utilidades';

  VM.logo = function (opts) {
    opts = opts || {};
    var arq = opts.escuro ? 'logo-lockup-dark.png' : 'logo-lockup.png';
    var img = '<img class="brand__logo' + (opts.cls ? ' ' + opts.cls : '') + '"' +
      ' src="assets/img/brand/' + arq + '"' +
      ' alt="' + (opts.alt === '' ? '' : LOGO_ALT) + '"' +
      (opts.alt === '' ? ' aria-hidden="true"' : '') + ' decoding="async">';

    if (!opts.compacto) return img;

    /* No header, o lockup inteiro ocupa ~150px e não sobra largura útil para a
       busca em telas estreitas. Abaixo de 640px entra só o símbolo. */
    return '<picture>' +
      '<source media="(max-width: 640px)" srcset="assets/img/brand/logo-mark.png">' +
      img + '</picture>';
  };

  var NAV = [
    { t: 'Início',     h: 'index.html' },
    { t: 'Produtos',   h: 'produtos.html', mega: true },
    { t: 'Serviços',   h: 'servicos.html' },
    { t: 'Blog',       h: 'blog.html' },
    { t: 'Quem Somos', h: 'quem-somos.html' },
    { t: 'Contato',    h: 'contato.html' }
  ];

  /* Categorias que representam a loja no rodapé. O resto do catálogo entra
     por "Ver tudo" — rodapé é orientação, não índice. */
  var CATS_RODAPE = ['eletrica', 'cabos-fios', 'iluminacao-led', 'ferramentas-manuais'];

  /* ======================================================================
     4. HEADER
     ====================================================================== */
  function megaHTML() {
    var cats = VM.categoriasAtivas().map(function (c) {
      return '<a class="mega__item" href="categoria.html?cat=' + c.slug + '">' +
               VM.ico(c.icone) +
               '<span><span class="mega__t">' + c.nome + '</span>' +
               '<span class="mega__d">' + c.desc.split('.')[0] + '.</span></span></a>';
    }).join('');
    return '<div class="mega">' + cats +
      '<a class="mega__item" href="produtos.html">' + VM.ico('p-projeto') +
      '<span><span class="mega__t">Ver todo o catálogo</span>' +
      '<span class="mega__d">Busca, filtros e ordenação.</span></span></a></div>';
  }

  function headerHTML(atual) {
    var navLinks = NAV.map(function (n) {
      var cur = (n.h === atual) ? ' aria-current="page"' : '';
      if (n.mega) {
        return '<div class="has-mega"><a href="' + n.h + '"' + cur + '>' + n.t + '</a>' + megaHTML() + '</div>';
      }
      return '<a href="' + n.h + '"' + cur + '>' + n.t + '</a>';
    }).join('');

    var mobileLinks = NAV.map(function (n) {
      return '<a href="' + n.h + '">' + n.t + '</a>';
    }).join('') + VM.categoriasAtivas().map(function (c) {
      return '<a href="categoria.html?cat=' + c.slug + '">' + VM.ico(c.icone) + c.nome + '</a>';
    }).join('');

    return '' +
    '<div class="headbar" id="headbar"><div class="container">' +
      '<a class="brand" href="index.html">' + VM.logo({ compacto: true }) + '</a>' +

      '<div class="searchbox">' +
        '<label class="sr-only" for="busca">Buscar produtos</label>' +
        '<input id="busca" type="search" autocomplete="off" placeholder="Buscar por produto, marca ou código…">' +
        '<button class="searchbox__btn" type="button" aria-label="Buscar">' + VM.icon('busca') + '</button>' +
        '<div class="suggest" id="suggest" hidden role="listbox" aria-label="Sugestões de busca"></div>' +
      '</div>' +

      '<div class="head-actions">' +
        '<button class="btn-icon cart-btn" id="abrir-carrinho" aria-label="Abrir carrinho">' +
          VM.icon('carrinho') +
          '<span class="cart-btn__count" data-cart-count data-count="0">0</span>' +
        '</button>' +
        '<button class="btn-icon burger" id="abrir-menu" aria-label="Abrir menu" aria-expanded="false">' + VM.icon('menu') + '</button>' +
      '</div>' +
    '</div></div>' +

    '<nav class="mainnav" aria-label="Navegação principal"><div class="container">' +
      navLinks +
      '<span class="mainnav__spacer"></span>' +
      '<a class="mainnav__phone" href="tel:41998920006">' + VM.icon('atendente') + 'Atendimento técnico: ' + EMPRESA.cel + '</a>' +
    '</div></nav>' +

    '<div class="mobile-nav" id="mobile-nav">' +
      '<div class="overlay" data-close-menu></div>' +
      '<div class="mobile-nav__panel" role="dialog" aria-modal="true" aria-label="Menu">' +
        '<div class="mobile-nav__head">' +
          '<a class="brand brand--sm" href="index.html">' + VM.logo() + '</a>' +
          '<button class="btn-icon" data-close-menu aria-label="Fechar menu">' + VM.icon('fechar') + '</button>' +
        '</div>' +
        '<div class="mobile-nav__links">' + mobileLinks + '</div>' +
        '<div class="mobile-nav__foot">' +
          '<a class="btn btn--wa btn--block" href="' + EMPRESA.whatsapp + '" target="_blank" rel="noopener">' + VM.icon('whatsapp') + 'Falar no WhatsApp</a>' +
          '<a class="btn btn--outline btn--block" href="tel:4130892453">' + VM.icon('telefone') + EMPRESA.fone + '</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ======================================================================
     5. RODAPÉ
     ====================================================================== */
  function footerHTML() {
    var escolhidas = CATS_RODAPE
      .map(function (slug) { return VM.categoria(slug); })
      .filter(Boolean);

    /* Slug removido do catálogo não pode deixar buraco: completa com o que houver. */
    VM.categoriasAtivas().forEach(function (c) {
      if (escolhidas.length < 4 && escolhidas.indexOf(c) === -1) escolhidas.push(c);
    });

    var cats = escolhidas.map(function (c) {
      return '<li><a href="categoria.html?cat=' + c.slug + '">' + c.nome + '</a></li>';
    }).join('');

    return '' +
    '<div class="container"><div class="footer-grid">' +
      '<div class="footer-col">' +
        '<div class="footer-brand">' + VM.logo({ escuro: true }) +
          '<span class="brand__tag">Desde ' + EMPRESA.desde + ' em Curitiba</span></div>' +
        '<p class="footer-about">Materiais elétricos, hidráulicos e utilidades com atendimento técnico de quem entende de obra. Mais de 30.000 itens em catálogo.</p>' +
        '<div class="footer-social">' +
          '<a href="' + EMPRESA.instagram + '" target="_blank" rel="noopener" aria-label="Instagram">' + VM.icon('instagram') + '</a>' +
          '<a href="' + EMPRESA.facebook + '" target="_blank" rel="noopener" aria-label="Facebook">' + VM.icon('facebook') + '</a>' +
          '<a href="' + EMPRESA.whatsapp + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + VM.icon('whatsapp') + '</a>' +
        '</div>' +
      '</div>' +

      '<div class="footer-col"><h4>Categorias</h4><ul>' + cats +
        '<li><a class="footer-link--forte" href="produtos.html">Ver tudo</a></li></ul></div>' +

      '<div class="footer-col"><h4>Institucional</h4><ul>' +
        '<li><a href="quem-somos.html">Quem somos</a></li>' +
        '<li><a href="servicos.html">Projetos e serviços</a></li>' +
        '<li><a href="blog.html">Blog</a></li>' +
        '<li><a href="contato.html">Contato</a></li>' +
        '<li><a href="politica.html">Política de privacidade</a></li>' +
        '<li><a href="politica.html#trocas">Trocas e devoluções</a></li>' +
      '</ul></div>' +

      '<div class="footer-col"><h4>Atendimento</h4><div class="footer-contact">' +
        '<div>' + VM.icon('local') + '<span>' + EMPRESA.endereco + '</span></div>' +
        '<div>' + VM.icon('telefone') + '<span><a href="tel:4130892453">' + EMPRESA.fone + '</a><br><a href="tel:41998920006">' + EMPRESA.cel + '</a></span></div>' +
        '<div>' + VM.icon('email') + '<span><a href="mailto:' + EMPRESA.email + '">' + EMPRESA.email + '</a></span></div>' +
        '<div>' + VM.icon('relogio') + '<span>' + EMPRESA.horario + '</span></div>' +
      '</div></div>' +
    '</div>' +

    '<div class="footer-bottom">' +
      '<span>© ' + new Date().getFullYear() + ' ' + EMPRESA.nome + ' · CNPJ ' + EMPRESA.cnpj + ' · Curitiba/PR - <b>versão de demonstração</b></span>' +
      '<div class="pay-badges">' +
        '<span class="pay-badge">Pix</span><span class="pay-badge">Boleto</span>' +
        '<span class="pay-badge">Visa</span><span class="pay-badge">Master</span>' +
        '<span class="pay-badge">Elo</span><span class="pay-badge">Site seguro</span>' +
      '</div>' +
    '</div></div>';
  }

  /* ======================================================================
     6. BUSCA COM SUGESTÕES
     ====================================================================== */
  function initBusca() {
    var input = VM.qs('#busca');
    var box = VM.qs('#suggest');
    if (!input || !box) return;

    var idx = -1;

    function fechar() { box.hidden = true; idx = -1; }

    function buscar(termo) {
      var t = VM.slugify(termo);
      if (t.length < 2) return [];
      return VM.produtos().filter(function (p) {
        return VM.slugify(p.nome + ' ' + p.marca + ' ' + p.sku).indexOf(t) > -1;
      }).slice(0, 6);
    }

    function render(termo) {
      var res = buscar(termo);
      if (!termo || termo.length < 2) { fechar(); return; }

      if (!res.length) {
        box.innerHTML = '<p class="suggest__empty">Nenhum produto encontrado para <b>' + termo + '</b>. ' +
          'Tente pelo código ou fale com nosso atendimento técnico.</p>';
        box.hidden = false;
        return;
      }

      box.innerHTML = res.map(function (p) {
        return '<a class="suggest__item" href="produto.html?p=' + p.slug + '" role="option">' +
          VM.ico(p.icone) +
          '<span><span class="suggest__name">' + p.nome + '</span>' +
          '<span class="suggest__meta">' + p.marca + ' · cód. ' + p.sku + '</span></span>' +
          '<span class="suggest__price">' + VM.money(p.preco) + '</span></a>';
      }).join('');
      box.hidden = false;
    }

    input.addEventListener('input', function () { render(this.value.trim()); });
    input.addEventListener('focus', function () { if (this.value.trim().length > 1) render(this.value.trim()); });

    input.addEventListener('keydown', function (e) {
      var itens = VM.qsa('.suggest__item', box);
      if (e.key === 'Enter') {
        if (idx > -1 && itens[idx]) { window.location.href = itens[idx].getAttribute('href'); return; }
        if (this.value.trim()) window.location.href = 'produtos.html?q=' + encodeURIComponent(this.value.trim());
        e.preventDefault(); return;
      }
      if (e.key === 'Escape') { fechar(); this.blur(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      if (!itens.length) return;
      idx = e.key === 'ArrowDown' ? Math.min(idx + 1, itens.length - 1) : Math.max(idx - 1, 0);
      itens.forEach(function (el, i) { el.classList.toggle('is-active', i === idx); });
      itens[idx].scrollIntoView({ block: 'nearest' });
    });

    VM.qs('.searchbox__btn').addEventListener('click', function () {
      if (input.value.trim()) window.location.href = 'produtos.html?q=' + encodeURIComponent(input.value.trim());
      else input.focus();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.searchbox')) fechar();
    });
  }

  /* ======================================================================
     7. DRAWERS (menu mobile e carrinho) - com foco preso e Esc
     ====================================================================== */
  var ultimoFoco = null;

  VM.abrirDrawer = function (el) {
    if (!el) return;
    ultimoFoco = document.activeElement;
    el.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    var alvo = el.querySelector('button, a, input');
    if (alvo) alvo.focus();
  };

  VM.fecharDrawer = function (el) {
    if (!el) return;
    el.classList.remove('is-open');
    if (!document.querySelector('.is-open')) document.body.style.overflow = '';
    if (ultimoFoco) { ultimoFoco.focus(); ultimoFoco = null; }
  };

  function initDrawers() {
    var menu = VM.qs('#mobile-nav');
    var btnMenu = VM.qs('#abrir-menu');

    if (btnMenu && menu) {
      btnMenu.addEventListener('click', function () {
        VM.abrirDrawer(menu);
        btnMenu.setAttribute('aria-expanded', 'true');
      });
      VM.qsa('[data-close-menu]', menu).forEach(function (b) {
        b.addEventListener('click', function () {
          VM.fecharDrawer(menu);
          btnMenu.setAttribute('aria-expanded', 'false');
        });
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      VM.qsa('.is-open').forEach(function (el) {
        if (el.classList.contains('mobile-nav') || el.classList.contains('cart-drawer') || el.classList.contains('filters')) {
          el.classList.remove('is-open');
          document.body.style.overflow = '';
          if (btnMenu) btnMenu.setAttribute('aria-expanded', 'false');
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var aberto = VM.qs('.mobile-nav.is-open .mobile-nav__panel, .cart-drawer.is-open .cart-drawer__panel');
      if (!aberto) return;
      var foca = VM.qsa('a[href], button:not([disabled]), input, select, textarea', aberto);
      if (!foca.length) return;
      var primeiro = foca[0], ultimo = foca[foca.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    });
  }

  /* ======================================================================
     7.1 MEGA-MENU - abertura com intenção de hover
     Sem o atraso no fechamento, o painel some quando o ponteiro atravessa a
     borda entre o link e o painel, ou quando o movimento é diagonal.
     ====================================================================== */
  function initMega() {
    VM.qsa('.has-mega').forEach(function (wrap) {
      var timer = null;

      function abrir() { clearTimeout(timer); wrap.classList.add('is-open'); }
      function fechar(atraso) {
        clearTimeout(timer);
        timer = setTimeout(function () { wrap.classList.remove('is-open'); }, atraso === 0 ? 0 : 240);
      }

      wrap.addEventListener('mouseenter', abrir);
      wrap.addEventListener('mouseleave', function () { fechar(); });
      wrap.addEventListener('focusin', abrir);
      wrap.addEventListener('focusout', function (e) {
        if (!wrap.contains(e.relatedTarget)) fechar(0);
      });

      /* fecha ao navegar a partir do painel ou ao apertar Esc */
      wrap.addEventListener('click', function () { fechar(0); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') fechar(0);
      });
    });
  }

  /* ======================================================================
     7.2 ACORDEÃO
     Um painel aberto por vez, com animação de altura. Sem GSAP, cai para o
     liga-desliga do atributo hidden, que continua acessível.
     ====================================================================== */
  VM.initAcordeao = function (sel) {
    var raiz = typeof sel === 'string' ? VM.qs(sel) : sel;
    if (!raiz) return;

    var gsap = window.gsap;
    var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var anima = !!gsap && !reduzido;
    var itens = VM.qsa('.acc__item', raiz);

    function painel(item) { return item.querySelector('.acc__panel'); }
    function botao(item) { return item.querySelector('.acc__btn'); }

    function abrir(item) {
      var p = painel(item), b = botao(item);
      b.setAttribute('aria-expanded', 'true');
      item.classList.add('is-open');
      p.hidden = false;

      if (!anima) return;
      gsap.killTweensOf(p);
      gsap.set(p, { height: 'auto', paddingBottom: '' });
      gsap.from(p, {
        height: 0, paddingBottom: 0, duration: .38, ease: 'power2.out',
        clearProps: 'height,paddingBottom'
      });
      gsap.from(p.children, { y: -10, opacity: 0, duration: .3, stagger: .06, delay: .08, ease: 'power2.out' });
    }

    function fechar(item, imediato) {
      var p = painel(item), b = botao(item);
      b.setAttribute('aria-expanded', 'false');
      item.classList.remove('is-open');

      if (!anima || imediato) { p.hidden = true; return; }
      gsap.killTweensOf(p);
      gsap.to(p, {
        height: 0, paddingBottom: 0, duration: .28, ease: 'power2.in',
        onComplete: function () {
          p.hidden = true;
          gsap.set(p, { clearProps: 'height,paddingBottom' });
        }
      });
    }

    itens.forEach(function (item) {
      botao(item).addEventListener('click', function () {
        var aberto = item.classList.contains('is-open');
        /* um por vez: fecha o que estiver aberto antes de abrir o novo */
        itens.forEach(function (outro) {
          if (outro !== item && outro.classList.contains('is-open')) fechar(outro);
        });
        if (aberto) fechar(item); else abrir(item);
      });
    });
  };

  /* ======================================================================
     7.3 CARROSSEL DE BANNERS
     O HTML da página descreve apenas os slides; setas e marcadores são
     gerados aqui para o componente funcionar com qualquer quantidade.
     Autoplay pausa no hover, no foco do teclado e com a aba em segundo
     plano - e não roda sozinho se o sistema pedir menos movimento.
     ====================================================================== */
  VM.initCarrossel = function (sel, opts) {
    var raiz = typeof sel === 'string' ? VM.qs(sel) : sel;
    if (!raiz) return;

    opts = opts || {};
    var intervalo = opts.intervalo || 6500;
    var trilha = raiz.querySelector('.carrossel__trilha');
    var slides = VM.qsa('.carrossel__slide', raiz);
    if (!trilha || slides.length < 2) return;

    var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var atual = 0;
    var timer = null;

    var nav = document.createElement('div');
    nav.className = 'carrossel__nav';
    nav.innerHTML =
      '<button class="carrossel__seta carrossel__seta--ant" type="button" aria-label="Banner anterior">' +
        VM.icon('chevron') + '</button>' +
      '<button class="carrossel__seta carrossel__seta--prox" type="button" aria-label="Próximo banner">' +
        VM.icon('chevron') + '</button>';
    raiz.appendChild(nav);

    var pontos = document.createElement('div');
    pontos.className = 'carrossel__pontos';
    pontos.innerHTML = slides.map(function (s, i) {
      var rot = s.getAttribute('data-titulo') || ('Banner ' + (i + 1));
      return '<button class="carrossel__ponto" type="button" aria-label="Ir para: ' + rot + '"></button>';
    }).join('');
    raiz.appendChild(pontos);

    function parar() { clearInterval(timer); timer = null; }
    function tocar() {
      if (reduzido || timer) return;
      timer = setInterval(function () { ir(atual + 1); }, intervalo);
    }

    function ir(i, doUsuario) {
      atual = (i + slides.length) % slides.length;
      trilha.style.transform = 'translateX(' + (-atual * 100) + '%)';

      slides.forEach(function (s, n) {
        var ativo = n === atual;
        s.setAttribute('aria-hidden', String(!ativo));
        /* Link de slide escondido não deve ser alcançável por Tab. */
        VM.qsa('a, button', s).forEach(function (f) {
          if (ativo) f.removeAttribute('tabindex');
          else f.setAttribute('tabindex', '-1');
        });
      });

      VM.qsa('.carrossel__ponto', pontos).forEach(function (p, n) {
        p.classList.toggle('is-active', n === atual);
        p.setAttribute('aria-current', String(n === atual));
      });

      if (doUsuario) { parar(); tocar(); }
    }

    nav.querySelector('.carrossel__seta--ant').addEventListener('click', function () { ir(atual - 1, true); });
    nav.querySelector('.carrossel__seta--prox').addEventListener('click', function () { ir(atual + 1, true); });

    pontos.addEventListener('click', function (e) {
      var b = e.target.closest('.carrossel__ponto');
      if (b) ir(VM.qsa('.carrossel__ponto', pontos).indexOf(b), true);
    });

    raiz.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { ir(atual - 1, true); }
      else if (e.key === 'ArrowRight') { ir(atual + 1, true); }
    });

    raiz.addEventListener('mouseenter', parar);
    raiz.addEventListener('mouseleave', tocar);
    raiz.addEventListener('focusin', parar);
    raiz.addEventListener('focusout', function (e) {
      if (!raiz.contains(e.relatedTarget)) tocar();
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) parar(); else tocar();
    });

    /* Arrastar com o dedo. */
    var x0 = null;
    raiz.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; parar(); }, { passive: true });
    raiz.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) ir(atual + (dx < 0 ? 1 : -1));
      x0 = null;
      tocar();
    }, { passive: true });

    ir(0);
    tocar();
  };

  /* ======================================================================
     8. TOASTS
     ====================================================================== */
  VM.toast = function (msg, tipo) {
    var wrap = VM.qs('.toasts');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toasts';
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'toast toast--' + (tipo || 'ok');
    t.innerHTML = VM.icon(tipo === 'warn' ? 'alerta' : 'checkCirc') + '<span>' + msg + '</span>';
    wrap.appendChild(t);

    if (window.gsap) {
      window.gsap.from(t, { y: 16, opacity: 0, duration: .3, ease: 'power2.out' });
    }
    setTimeout(function () {
      if (window.gsap) {
        window.gsap.to(t, { y: 10, opacity: 0, duration: .25, onComplete: function () { t.remove(); } });
      } else { t.remove(); }
    }, 3200);
  };

  /* ======================================================================
     9. HEADER GRUDADO
     ====================================================================== */
  function initSticky() {
    var bar = VM.qs('#headbar');
    if (!bar) return;

    /* O header encolhe 16px ao grudar, e ele fica no fluxo: encolher reduz a
       altura do documento na mesma medida e empurra o conteudo para cima. Com
       um limiar unico e rente ao topo, esse deslocamento cruzava o limiar de
       volta e a barra ficava piscando entre os dois tamanhos.

       Dois limiares afastados resolvem: gruda so depois de 72px de rolagem e
       so solta abaixo de 24px. O vao de 48px e maior que os 16px que o
       documento se move, entao a mudanca de altura nunca consegue reverter o
       proprio gatilho. O rAF garante uma avaliacao por quadro. */
    var GRUDA = 72;
    var SOLTA = 24;
    var grudado = false;
    var agendado = false;

    function avaliar() {
      agendado = false;
      var y = window.scrollY;
      if (!grudado && y > GRUDA) {
        grudado = true;
        bar.classList.add('is-stuck');
      } else if (grudado && y < SOLTA) {
        grudado = false;
        bar.classList.remove('is-stuck');
      }
    }

    function aoRolar() {
      if (agendado) return;
      agendado = true;
      window.requestAnimationFrame(avaliar);
    }

    window.addEventListener('scroll', aoRolar, { passive: true });
    avaliar();
  }

  /* ======================================================================
     10. FAB WHATSAPP
     ====================================================================== */
  function initFab() {
    if (VM.qs('.wa-fab')) return;
    var a = document.createElement('a');
    a.className = 'wa-fab';
    a.href = EMPRESA.whatsapp;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Falar com a VM Click no WhatsApp');
    a.innerHTML = VM.icon('whatsapp') + '<span>Fale conosco</span>';
    document.body.appendChild(a);
  }

  /* ======================================================================
     11. BOOT
     ====================================================================== */
  function boot() {
    var atual = (window.location.pathname.split('/').pop() || 'index.html');

    var header = VM.qs('#site-header');
    if (header) header.innerHTML = headerHTML(atual);

    var footer = VM.qs('#site-footer');
    if (footer) footer.innerHTML = footerHTML();

    initBusca();
    initMega();
    initDrawers();
    initSticky();
    initFab();

    if (window.VMCart && window.VMCart.init) window.VMCart.init();
    document.dispatchEvent(new CustomEvent('vm:ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

