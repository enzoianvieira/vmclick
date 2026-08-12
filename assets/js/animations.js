/* ==========================================================================
   VM Click - animações (GSAP + ScrollTrigger)
   Regra: a animação nunca decide se o conteúdo existe. Sem GSAP, sem JS ou com
   "prefers-reduced-motion", tudo aparece normalmente.
   ========================================================================== */
(function () {
  'use strict';

  var VMAnim = window.VMAnim = {};
  var raiz = document.documentElement;
  var reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Sem biblioteca ou com movimento reduzido: libera o conteúdo e encerra. */
  if (!window.gsap || reduzido) {
    raiz.classList.remove('js-anim');
    VMAnim.cards = function () {};
    return;
  }

  var gsap = window.gsap;
  if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

  var EASE = 'power3.out';

  /* ======================================================================
     1. Entrada do hero
     ====================================================================== */
  function hero() {
    var h = document.querySelector('.hero');
    if (!h) return;

    var tl = gsap.timeline({ defaults: { ease: EASE } });

    tl.from('.hero__eyebrow', { y: 14, opacity: 0, duration: .5 })
      .from('.hero h1 .line > span', { yPercent: 108, duration: .9, stagger: .09 }, '-=.25')
      .from('.hero__lead',  { y: 18, opacity: 0, duration: .6 }, '-=.5')
      .from('.hero__cta > *', { y: 16, opacity: 0, duration: .5, stagger: .08 }, '-=.35')
      .from('.hero__stat',  { y: 16, opacity: 0, duration: .5, stagger: .08 }, '-=.3')
      .from('.hero__panel', { x: 40, opacity: 0, duration: .8 }, '-=.9')
      .from('.hero__cats li', { x: 18, opacity: 0, duration: .4, stagger: .06 }, '-=.5');

    contadores(h);
  }

  /* ======================================================================
     2. Contadores numéricos
     ====================================================================== */
  function contadores(escopo) {
    var alvos = (escopo || document).querySelectorAll('[data-conta]');
    Array.prototype.forEach.call(alvos, function (el) {
      var fim = parseFloat(el.getAttribute('data-conta'));
      var sufixo = el.getAttribute('data-sufixo') || '';
      var prefixo = el.getAttribute('data-prefixo') || '';
      var obj = { v: 0 };

      gsap.to(obj, {
        v: fim, duration: 1.6, ease: 'power2.out',
        scrollTrigger: window.ScrollTrigger ? { trigger: el, start: 'top 88%', once: true } : undefined,
        onUpdate: function () {
          el.textContent = prefixo + Math.round(obj.v).toLocaleString('pt-BR') + sufixo;
        }
      });
    });
  }

  /* ======================================================================
     3. Revelações por scroll
     ====================================================================== */
  function revelacoes() {
    if (!window.ScrollTrigger) {
      gsap.set('.reveal', { opacity: 1, y: 0 });
      return;
    }
    var itens = document.querySelectorAll('.reveal');
    Array.prototype.forEach.call(itens, function (el) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: .7, ease: EASE,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
  }

  /* ======================================================================
     4. Grades de produto (chamado depois de cada render)
     ====================================================================== */
  VMAnim.cards = function (escopo) {
    var el = typeof escopo === 'string' ? document.querySelector(escopo) : escopo;
    if (!el) return;
    var cards = el.querySelectorAll('.product, .cat-card');
    if (!cards.length) return;
    gsap.fromTo(cards,
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: .5, ease: EASE, stagger: .04, overwrite: true }
    );
  };

  /* ======================================================================
     5. Barras de seção com leve paralaxe no título
     ====================================================================== */
  function paralaxeTitulos() {
    if (!window.ScrollTrigger) return;
    var alvos = document.querySelectorAll('[data-paralaxe]');
    Array.prototype.forEach.call(alvos, function (el) {
      gsap.to(el, {
        yPercent: -12, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: .6 }
      });
    });
  }

  /* ======================================================================
     6. Transição de saída entre páginas
     ====================================================================== */
  function transicaoPaginas() {
    var veu = document.createElement('div');
    veu.style.cssText =
      'position:fixed;inset:0;background:#04211E;z-index:9999;pointer-events:none;opacity:0';
    document.body.appendChild(veu);

    gsap.set(veu, { opacity: 0 });

    document.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || a.target === '_blank' ||
          href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0 ||
          href.indexOf('http') === 0 || e.metaKey || e.ctrlKey) return;

      e.preventDefault();
      gsap.to(veu, {
        opacity: 1, duration: .28, ease: 'power2.in',
        onComplete: function () { window.location.href = href; }
      });
    });

    window.addEventListener('pageshow', function () {
      gsap.to(veu, { opacity: 0, duration: .3 });
    });
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  function boot() {
    hero();
    revelacoes();
    contadores(document);
    paralaxeTitulos();
    transicaoPaginas();
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

