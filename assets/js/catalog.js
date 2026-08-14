/* ==========================================================================
   VM Click - catálogo: card, vitrine (PLP), filtros e página de produto (PDP)
   A marcação segue as classes do WooCommerce para que o porte ao WordPress
   seja substituição de template.
   ========================================================================== */
(function () {
  'use strict';

  var VM = window.VM;
  var POR_PAGINA = 30;

  /* ======================================================================
     1. CARD DE PRODUTO
     ====================================================================== */
  VM.cardHTML = function (p) {
    var esgotado = p.estoque <= 0;
    var desconto = p.precoDe ? Math.round((1 - p.preco / p.precoDe) * 100) : 0;
    var parc = VM.parcelas(p.preco);
    var cat = VM.categoria(p.cat);

    var flags = '';
    if (desconto > 0) flags += '<span class="badge badge--promo">-' + desconto + '%</span>';
    if (p.novo && !esgotado) flags += '<span class="badge badge--novo">Novidade</span>';
    if (esgotado) flags += '<span class="badge badge--bad">Esgotado</span>';
    else if (p.estoque <= 20) flags += '<span class="badge badge--warn">Últimas ' + p.estoque + '</span>';

    var img = (p.imagens && p.imagens.length) ? p.imagens[0] : '';
    var thumb = img
      ? '<img class="product__img" src="' + img + '" alt="' + (p.nome || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" onerror="this.remove()">'
      : VM.ico(p.icone);

    return '' +
    '<li class="product' + (esgotado ? ' is-out' : '') + '" data-produto="' + p.slug + '">' +
      '<div class="product__thumb">' +
        '<div class="product__flags">' + flags + '</div>' +
        '<button class="product__fav" type="button" aria-label="Favoritar ' + p.nome + '">' + VM.icon('coracao') + '</button>' +
        thumb +
      '</div>' +
      '<div class="product__body">' +
        '<span class="product__cat">' + (cat ? cat.curto : '') + '</span>' +
        '<a class="woocommerce-LoopProduct-link" href="produto.html?p=' + p.slug + '">' +
          '<h3 class="woocommerce-loop-product__title">' + p.nome + '</h3>' +
        '</a>' +
        '<span class="product__sku">cód. ' + p.sku + '</span>' +
        '<span class="product__rating">' + VM.icon('estrela') + '<span class="num">' + p.nota.toFixed(1) + '</span>' +
          '<span>(' + p.avaliacoes + ')</span></span>' +
        '<span class="price">' +
          (p.precoDe ? '<del>' + VM.money(p.precoDe) + '</del>' : '') +
          '<ins>' + VM.money(p.preco) + '</ins>' +
          (parc ? '<span class="price__inst">ou ' + parc.n + '× de ' + VM.money(parc.v) + ' sem juros</span>'
                : '<span class="price__inst">à vista</span>') +
          '<span class="price__pix">' + VM.money(VM.pix(p.preco)) + ' no Pix</span>' +
        '</span>' +
        '<div class="product__foot">' +
          (esgotado
            ? '<button class="btn btn--outline btn--sm btn--block" type="button" data-avise="' + p.slug + '">Avise-me</button>'
            : '<button class="btn btn--primary btn--sm btn--block add_to_cart_button" type="button" data-add="' + p.slug + '">Adicionar</button>') +
        '</div>' +
      '</div>' +
    '</li>';
  };

  VM.renderProdutos = function (alvo, lista) {
    var el = typeof alvo === 'string' ? VM.qs(alvo) : alvo;
    if (!el) return;
    el.className = 'products';
    el.innerHTML = lista.map(VM.cardHTML).join('');
  };

  /* Card inteiro clicável. O link do título continua sendo o link real para
     teclado e leitor de tela; isto aqui só amplia a área de clique do mouse. */
  document.addEventListener('click', function (e) {
    var card = e.target.closest('.product[data-produto]');
    if (!card) return;
    if (e.target.closest('a, button')) return;      /* respeita botões e links */
    if (window.getSelection && String(window.getSelection())) return;  /* seleção de texto */
    window.location.href = 'produto.html?p=' + card.getAttribute('data-produto');
  });

  /* ======================================================================
     2. VITRINE (produtos.html e categoria.html)
     ====================================================================== */
  VM.initVitrine = function (opts) {
    opts = opts || {};
    var catFixa = opts.cat || null;

    var estado = {
      q: VM.param('q') || '',
      cats: catFixa ? [catFixa] : [],
      marcas: [],
      min: null,
      max: null,
      soEstoque: false,
      ord: 'relevancia',
      pag: 1
    };

    var base = VM.produtos().filter(function (p) { return catFixa ? p.cat === catFixa : true; });

    /* ------------------------------------------------------------ filtros */
    function aplicar() {
      var q = VM.slugify(estado.q);
      var r = base.filter(function (p) {
        if (q && VM.slugify(p.nome + ' ' + p.marca + ' ' + p.sku + ' ' + p.desc).indexOf(q) === -1) return false;
        if (!catFixa && estado.cats.length && estado.cats.indexOf(p.cat) === -1) return false;
        if (estado.marcas.length && estado.marcas.indexOf(p.marca) === -1) return false;
        if (estado.min !== null && p.preco < estado.min) return false;
        if (estado.max !== null && p.preco > estado.max) return false;
        if (estado.soEstoque && p.estoque <= 0) return false;
        return true;
      });

      var ord = estado.ord;
      r.sort(function (a, b) {
        /* regra global: esgotados sempre por último, independente da ordenação */
        var aStk = (a.estoque > 0) ? 1 : 0;
        var bStk = (b.estoque > 0) ? 1 : 0;
        if (aStk !== bStk) return bStk - aStk;

        if (ord === 'menor') return a.preco - b.preco;
        if (ord === 'maior') return b.preco - a.preco;
        if (ord === 'nome')  return a.nome.localeCompare(b.nome, 'pt-BR');
        if (ord === 'nota')  return b.nota - a.nota || b.avaliacoes - a.avaliacoes;

        /* relevância: com imagem > destaque > avaliações > alfabético */
        var aImg = (a.imagens && a.imagens.length > 0) ? 1 : 0;
        var bImg = (b.imagens && b.imagens.length > 0) ? 1 : 0;
        return (bImg - aImg)
            || ((b.destaque ? 1 : 0) - (a.destaque ? 1 : 0))
            || (b.avaliacoes - a.avaliacoes)
            || a.nome.localeCompare(b.nome, 'pt-BR');
      });
      return r;
    }

    /* ------------------------------------------------------------- render */
    function render() {
      var res = aplicar();
      var paginas = Math.max(1, Math.ceil(res.length / POR_PAGINA));
      if (estado.pag > paginas) estado.pag = 1;
      var pagina = res.slice((estado.pag - 1) * POR_PAGINA, estado.pag * POR_PAGINA);

      var grid = VM.qs('#grid');
      var contador = VM.qs('#contador');

      if (contador) {
        contador.innerHTML = res.length
          ? 'Mostrando <b>' + pagina.length + '</b> de <b>' + res.length + '</b> produtos'
          : 'Nenhum produto encontrado';
      }

      if (!res.length) {
        grid.className = '';
        grid.innerHTML =
          '<div class="empty-state">' + VM.icon('busca') +
          '<h3>Nada encontrado com esses filtros</h3>' +
          '<p class="muted" style="margin-top:8px">Tente remover algum filtro, buscar pelo código do produto ' +
          'ou falar com o atendimento técnico - trabalhamos com mais de 30.000 itens.</p>' +
          '<div class="row" style="justify-content:center;margin-top:20px">' +
          '<button class="btn btn--outline" id="limpar-tudo">Limpar filtros</button>' +
          '<a class="btn btn--wa" href="' + VM.EMPRESA.whatsapp + '" target="_blank" rel="noopener">Falar no WhatsApp</a>' +
          '</div></div>';
      } else {
        VM.renderProdutos(grid, pagina);
      }

      renderChips(res.length);
      renderPaginacao(paginas);
      if (window.VMAnim && window.VMAnim.cards) window.VMAnim.cards(grid);
    }

    function renderChips() {
      var wrap = VM.qs('#chips');
      if (!wrap) return;
      var chips = [];
      if (estado.q) chips.push({ t: 'Busca: ' + estado.q, f: function () { estado.q = ''; var b = VM.qs('#busca-vitrine'); if (b) b.value = ''; } });
      estado.cats.forEach(function (c) {
        if (catFixa) return;
        var cat = VM.categoria(c);
        chips.push({ t: cat ? cat.nome : c, f: function () { estado.cats = estado.cats.filter(function (x) { return x !== c; }); } });
      });
      estado.marcas.forEach(function (m) {
        chips.push({ t: m, f: function () { estado.marcas = estado.marcas.filter(function (x) { return x !== m; }); } });
      });
      if (estado.min !== null || estado.max !== null) {
        chips.push({ t: 'Preço personalizado', f: function () { estado.min = estado.max = null; VM.qs('#pmin').value = ''; VM.qs('#pmax').value = ''; } });
      }
      if (estado.soEstoque) chips.push({ t: 'Somente em estoque', f: function () { estado.soEstoque = false; } });

      wrap.innerHTML = chips.map(function (c, i) {
        return '<span class="chip">' + c.t + '<button type="button" data-chip="' + i + '" aria-label="Remover filtro ' + c.t + '">×</button></span>';
      }).join('');

      VM.qsa('[data-chip]', wrap).forEach(function (b) {
        b.addEventListener('click', function () {
          chips[parseInt(b.getAttribute('data-chip'), 10)].f();
          sincronizarInputs();
          render();
        });
      });
    }

    function renderPaginacao(paginas) {
      var wrap = VM.qs('#paginacao');
      if (!wrap) return;
      if (paginas <= 1) { wrap.innerHTML = ''; return; }

      var atual = estado.pag;
      var itens = paginacaoCondensada(atual, paginas);

      var html = '<button type="button" data-pag="' + (atual - 1) + '"' + (atual === 1 ? ' disabled' : '') + '>Anterior</button>';
      for (var i = 0; i < itens.length; i++) {
        var it = itens[i];
        if (it === '...') {
          html += '<span class="pag-ellipsis" aria-hidden="true">…</span>';
        } else {
          html += '<button type="button" data-pag="' + it + '"' + (it === atual ? ' aria-current="true"' : '') + '>' + it + '</button>';
        }
      }
      html += '<button type="button" data-pag="' + (atual + 1) + '"' + (atual === paginas ? ' disabled' : '') + '>Próxima</button>';

      if (paginas > 10) {
        html += '<label class="pag-jump"><span>Ir p/</span>' +
          '<input type="number" min="1" max="' + paginas + '" value="' + atual + '" id="pag-input" inputmode="numeric" aria-label="Ir para página">' +
          '<span>de ' + paginas + '</span></label>';
      }

      wrap.innerHTML = html;

      VM.qsa('[data-pag]', wrap).forEach(function (b) {
        b.addEventListener('click', function () {
          irParaPagina(parseInt(b.getAttribute('data-pag'), 10), paginas);
        });
      });

      var input = VM.qs('#pag-input', wrap);
      if (input) {
        input.addEventListener('change', function () {
          irParaPagina(parseInt(input.value, 10), paginas);
        });
        input.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); irParaPagina(parseInt(input.value, 10), paginas); }
        });
      }
    }

    function paginacaoCondensada(atual, total) {
      var VIZINHOS = 1;
      var BORDA = 1;
      var minPag = Math.max(BORDA + 1, atual - VIZINHOS);
      var maxPag = Math.min(total - BORDA, atual + VIZINHOS);
      var out = [];

      for (var i = 1; i <= BORDA; i++) out.push(i);
      if (minPag > BORDA + 1) out.push('...');
      for (var j = minPag; j <= maxPag; j++) out.push(j);
      if (maxPag < total - BORDA) out.push('...');
      for (var k = total - BORDA + 1; k <= total; k++) if (k > BORDA) out.push(k);

      return out;
    }

    function irParaPagina(n, total) {
      if (!Number.isFinite(n)) return;
      n = Math.max(1, Math.min(total, n));
      if (n === estado.pag) return;
      estado.pag = n;
      render();
      window.scrollTo({ top: VM.qs('#grid').offsetTop - 140, behavior: 'smooth' });
    }

    /* ------------------------------------------------------ painel lateral */
    function montarFiltros() {
      var wrap = VM.qs('#filtros');
      if (!wrap) return;

      var html = '<div class="filters__close"><span class="filter-group__title" style="margin:0">Filtros</span>' +
        '<button class="btn-icon" type="button" id="fechar-filtros" aria-label="Fechar filtros">' + VM.icon('fechar') + '</button></div>';

      if (!catFixa) {
        html += '<div class="filter-group"><span class="filter-group__title">Categoria</span>' +
          VM.categorias().map(function (c) {
            var n = base.filter(function (p) { return p.cat === c.slug; }).length;
            return '<label class="filter-opt"><input type="checkbox" data-f="cat" value="' + c.slug + '">' +
              c.nome + '<span class="filter-opt__n">' + n + '</span></label>';
          }).join('') + '</div>';
      }

      var marcas = {};
      base.forEach(function (p) { marcas[p.marca] = (marcas[p.marca] || 0) + 1; });
      var listaMarcas = Object.keys(marcas).sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });

      html += '<div class="filter-group"><span class="filter-group__title">Marca</span>' +
        listaMarcas.map(function (m) {
          return '<label class="filter-opt"><input type="checkbox" data-f="marca" value="' + m + '">' +
            m + '<span class="filter-opt__n">' + marcas[m] + '</span></label>';
        }).join('') + '</div>';

      html += '<div class="filter-group"><span class="filter-group__title">Faixa de preço</span>' +
        '<div class="range-row">' +
          '<input type="number" id="pmin" placeholder="Mín." aria-label="Preço mínimo" min="0">' +
          '<span class="subtle">até</span>' +
          '<input type="number" id="pmax" placeholder="Máx." aria-label="Preço máximo" min="0">' +
        '</div></div>';

      html += '<div class="filter-group"><span class="filter-group__title">Disponibilidade</span>' +
        '<label class="filter-opt"><input type="checkbox" id="so-estoque">Somente em estoque' +
        '<span class="filter-opt__n">' + base.filter(function (p) { return p.estoque > 0; }).length + '</span></label></div>';

      html += '<button class="btn btn--ghost btn--sm" type="button" id="limpar-filtros">Limpar todos os filtros</button>';

      wrap.innerHTML = html;

      VM.qsa('[data-f]', wrap).forEach(function (input) {
        input.addEventListener('change', function () {
          var tipo = input.getAttribute('data-f');
          var alvo = tipo === 'cat' ? estado.cats : estado.marcas;
          var v = input.value;
          if (input.checked) { if (alvo.indexOf(v) === -1) alvo.push(v); }
          else { alvo.splice(alvo.indexOf(v), 1); }
          estado.pag = 1;
          render();
        });
      });

      ['pmin', 'pmax'].forEach(function (id) {
        VM.qs('#' + id).addEventListener('input', function () {
          var v = parseFloat(this.value);
          estado[id === 'pmin' ? 'min' : 'max'] = isNaN(v) ? null : v;
          estado.pag = 1;
          render();
        });
      });

      VM.qs('#so-estoque').addEventListener('change', function () {
        estado.soEstoque = this.checked;
        estado.pag = 1;
        render();
      });

      VM.qs('#limpar-filtros').addEventListener('click', limparTudo);
      VM.qs('#fechar-filtros').addEventListener('click', function () { wrap.classList.remove('is-open'); document.body.style.overflow = ''; });
    }

    function limparTudo() {
      estado.q = '';
      estado.cats = catFixa ? [catFixa] : [];
      estado.marcas = [];
      estado.min = estado.max = null;
      estado.soEstoque = false;
      estado.pag = 1;
      sincronizarInputs();
      render();
    }

    function sincronizarInputs() {
      VM.qsa('[data-f]').forEach(function (i) {
        var tipo = i.getAttribute('data-f');
        var alvo = tipo === 'cat' ? estado.cats : estado.marcas;
        i.checked = alvo.indexOf(i.value) > -1;
      });
      var se = VM.qs('#so-estoque'); if (se) se.checked = estado.soEstoque;
      var bv = VM.qs('#busca-vitrine'); if (bv) bv.value = estado.q;
    }

    /* -------------------------------------------------------------- barra */
    var ordSel = VM.qs('#ordenar');
    if (ordSel) ordSel.addEventListener('change', function () { estado.ord = this.value; estado.pag = 1; render(); });

    var buscaVitrine = VM.qs('#busca-vitrine');
    if (buscaVitrine) {
      buscaVitrine.value = estado.q;
      buscaVitrine.addEventListener('input', function () { estado.q = this.value.trim(); estado.pag = 1; render(); });
    }

    var abrirFiltros = VM.qs('#abrir-filtros');
    if (abrirFiltros) {
      abrirFiltros.addEventListener('click', function () {
        VM.qs('#filtros').classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
    }

    document.addEventListener('click', function (e) {
      if (e.target.id === 'limpar-tudo') limparTudo();
      var avise = e.target.closest('[data-avise]');
      if (avise) VM.toast('Avisaremos assim que o produto voltar ao estoque.', 'warn');
      var fav = e.target.closest('.product__fav');
      if (fav) { fav.classList.toggle('is-on'); }
    });

    montarFiltros();
    sincronizarInputs();
    render();
  };

  /* ======================================================================
     3. PÁGINA DE PRODUTO (PDP)
     ====================================================================== */
  VM.initPDP = function () {
    var slug = VM.param('p');
    var p = slug ? VM.produto(slug) : null;
    var raiz = VM.qs('#pdp');
    if (!raiz) return;

    if (!p) {
      raiz.innerHTML =
        '<div class="empty-state" style="grid-column:1/-1">' + VM.icon('caixa') +
        '<h3>Produto não encontrado</h3>' +
        '<p class="muted" style="margin-top:8px">O link pode estar desatualizado.</p>' +
        '<a class="btn btn--secondary" style="margin-top:20px" href="produtos.html">Voltar ao catálogo</a></div>';
      return;
    }

    document.title = p.nome + ' | VM Click';
    var cat = VM.categoria(p.cat);
    var esgotado = p.estoque <= 0;
    var desconto = p.precoDe ? Math.round((1 - p.preco / p.precoDe) * 100) : 0;
    var parc = VM.parcelas(p.preco);

    /* migalha */
    var mig = VM.qs('#migalha');
    if (mig) {
      mig.innerHTML =
        '<a href="index.html">Início</a><span class="sep">/</span>' +
        '<a href="produtos.html">Produtos</a><span class="sep">/</span>' +
        '<a href="categoria.html?cat=' + p.cat + '">' + (cat ? cat.nome : '') + '</a><span class="sep">/</span>' +
        '<span aria-current="page">' + p.nome + '</span>';
    }

    var specs = Object.keys(p.specs).map(function (k) {
      return '<tr><th scope="row">' + k + '</th><td>' + p.specs[k] + '</td></tr>';
    }).join('');

    var estrelas = '';
    for (var i = 0; i < 5; i++) {
      estrelas += VM.icon('estrela', i < Math.round(p.nota) ? '' : 'off');
    }

    /* --------------------------------------------------------------------
       Galeria: três vistas de verdade, não a mesma imagem repetida.
       1. Ilustração do produto
       2. Vista com cotas, destacando a medida principal
       3. Ficha resumida com as especificações que mais pesam na decisão
       As fotos reais entram junto com a integração do Olist Tiny.
       -------------------------------------------------------------------- */
    var chaves = Object.keys(p.specs);
    var chavePrincipal = chaves.filter(function (k) {
      return /Diâmetro|Comprimento|Potência|Corrente|Volume|Capacidade|Seção|Tamanho|Peso|Bitola|Dimensões|Largura/.test(k);
    })[0] || chaves[0];

    var vistas = [
      { id: 'produto', rotulo: 'Produto', ico: p.icone },
      { id: 'escala',  rotulo: 'Medidas', ico: p.icone },
      { id: 'ficha',   rotulo: 'Ficha',   ico: 'p-projeto' }
    ];

    var fichaResumo = chaves.slice(0, 4).map(function (k) {
      return '<div class="pdp__ficha-row"><span>' + k + '</span><b>' + p.specs[k] + '</b></div>';
    }).join('');

    var temImagens = p.imagens && p.imagens.length > 0;

    var galeriaHTML;
    if (temImagens) {
      var nomeEsc = (p.nome || '').replace(/"/g, '&quot;');
      galeriaHTML =
        '<div class="pdp__gallery pdp__gallery--fotos">' +
          '<div class="pdp__main" id="pdp-main">' +
            '<div class="product__flags">' +
              (desconto ? '<span class="badge badge--promo">-' + desconto + '%</span>' : '') +
              (p.novo ? '<span class="badge badge--novo">Novidade</span>' : '') +
            '</div>' +
            '<img class="pdp__foto" id="pdp-foto" src="' + p.imagens[0] + '" alt="' + nomeEsc + '" loading="eager" decoding="async" onerror="this.style.display=\'none\'">' +
          '</div>' +
          '<div class="pdp__thumbs" role="tablist" aria-label="Fotos do produto">' +
            p.imagens.map(function (url, i) {
              return '<button type="button" role="tab" class="pdp__thumb-foto" data-foto-idx="' + i + '" ' +
                'aria-current="' + (i === 0 ? 'true' : 'false') + '" aria-label="Foto ' + (i + 1) + '">' +
                '<img src="' + url + '" alt="" loading="lazy" onerror="this.parentElement.remove()">' +
              '</button>';
            }).join('') +
          '</div>' +
        '</div>';
    } else {
      galeriaHTML =
        '<div class="pdp__gallery">' +
          '<div class="pdp__main" id="pdp-main">' +
            '<div class="product__flags">' +
              (desconto ? '<span class="badge badge--promo">-' + desconto + '%</span>' : '') +
              (p.novo ? '<span class="badge badge--novo">Novidade</span>' : '') +
            '</div>' +

            '<div class="pdp__view" data-vista="produto">' + VM.ico(p.icone) + '</div>' +

            '<div class="pdp__view" data-vista="escala" hidden>' +
              '<div class="pdp__cota">' +
                '<span class="pdp__cota-eixo pdp__cota-eixo--h" aria-hidden="true"></span>' +
                '<span class="pdp__cota-eixo pdp__cota-eixo--v" aria-hidden="true"></span>' +
                VM.ico(p.icone) +
              '</div>' +
              '<span class="pdp__cota-label">' + chavePrincipal + ': <b>' + (p.specs[chavePrincipal] || '-') + '</b></span>' +
            '</div>' +

            '<div class="pdp__view pdp__view--ficha" data-vista="ficha" hidden>' +
              '<span class="pdp__ficha-t">Resumo técnico</span>' +
              fichaResumo +
              '<span class="pdp__ficha-sku">cód. ' + p.sku + ' · ' + p.marca + '</span>' +
            '</div>' +
          '</div>' +

          '<div class="pdp__thumbs" role="tablist" aria-label="Vistas do produto">' +
            vistas.map(function (v, i) {
              return '<button type="button" role="tab" data-vista-btn="' + v.id + '" ' +
                'aria-current="' + (i === 0 ? 'true' : 'false') + '" aria-label="Ver ' + v.rotulo + '">' +
                VM.ico(v.ico) + '<span>' + v.rotulo + '</span></button>';
            }).join('') +
          '</div>' +

          '<p class="mono subtle" style="text-align:center">Sem foto real cadastrada no ERP.</p>' +
        '</div>';
    }

    raiz.innerHTML = '' + galeriaHTML +

    '<div class="pdp__info">' +
      '<span class="pdp__brand">' + p.marca + '</span>' +
      '<h1>' + p.nome + '</h1>' +
      '<div class="pdp__meta">' +
        '<span class="stars">' + estrelas + '</span>' +
        '<a class="num" href="#avaliacoes">' + p.nota.toFixed(1).replace('.', ',') +
        ' (' + p.avaliacoes + ' avaliações)</a>' +
        '<span>cód. <b class="mono">' + p.sku + '</b></span>' +
        (esgotado
          ? '<span class="badge badge--bad">Esgotado</span>'
          : '<span class="badge badge--ok">' + p.estoque + ' em estoque</span>') +
      '</div>' +

      '<div class="pdp__price">' +
        (p.precoDe ? '<del>' + VM.money(p.precoDe) + '</del>' : '') +
        '<div class="now">' + VM.money(p.preco) +
          (desconto ? '<span class="badge badge--promo">-' + desconto + '%</span>' : '') + '</div>' +
        '<div class="pix">' + VM.money(VM.pix(p.preco)) + ' à vista no Pix (5% de desconto)</div>' +
        (parc ? '<div class="inst">ou ' + parc.n + '× de ' + VM.money(parc.v) + ' sem juros no cartão</div>' : '') +
      '</div>' +

      '<div class="pdp__buy">' +
        '<div class="qty">' +
          '<button type="button" id="qtd-menos" aria-label="Diminuir quantidade">−</button>' +
          '<input type="number" id="pdp-qtd" value="1" min="1" max="' + Math.max(1, p.estoque) + '" aria-label="Quantidade">' +
          '<button type="button" id="qtd-mais" aria-label="Aumentar quantidade">+</button>' +
        '</div>' +
        (esgotado
          ? '<button class="btn btn--outline btn--lg" type="button" data-avise="' + p.slug + '">Avise-me quando chegar</button>'
          : '<button class="btn btn--primary btn--lg add_to_cart_button" type="button" data-add="' + p.slug + '" data-usa-qtd>Adicionar ao carrinho</button>' +
            '<button class="btn btn--secondary btn--lg" type="button" data-comprar="' + p.slug + '">Comprar agora</button>') +
      '</div>' +

      '<div class="cep-box">' +
        '<span class="cep-box__title">' + VM.icon('caminhao') + 'Simular frete e prazo</span>' +
        '<form class="cep-form" id="cep-form">' +
          '<label class="sr-only" for="cep">CEP de entrega</label>' +
          '<input id="cep" inputmode="numeric" maxlength="9" placeholder="00000-000">' +
          '<button class="btn btn--outline" type="submit">Calcular</button>' +
        '</form>' +
        '<div id="cep-result"></div>' +
        '<p class="mono subtle">Simulação de demonstração. O cálculo real de frete entra na fase 2.</p>' +
      '</div>' +

      '<ul class="pdp__points">' +
        '<li>' + VM.icon('loja') + '<span>Retirada grátis na loja: R. Amadeu do Amaral, 1602 - Portão, Curitiba.</span></li>' +
        '<li>' + VM.icon('atendente') + '<span>Dúvida técnica sobre dimensionamento? Fale com nossa equipe antes de comprar.</span></li>' +
        '<li>' + VM.icon('escudo') + '<span>Produtos certificados, com nota fiscal e garantia do fabricante.</span></li>' +
      '</ul>' +

      '<div>' +
        '<div class="tabs" role="tablist">' +
          '<button role="tab" aria-selected="true" aria-controls="tab-desc" id="t-desc">Descrição</button>' +
          '<button role="tab" aria-selected="false" aria-controls="tab-spec" id="t-spec">Especificações</button>' +
          '<button role="tab" aria-selected="false" aria-controls="tab-ent" id="t-ent">Entrega e devolução</button>' +
        '</div>' +
        '<div class="tabpanel" id="tab-desc" role="tabpanel" aria-labelledby="t-desc">' +
          '<p class="muted">' + p.desc + '</p></div>' +
        '<div class="tabpanel" id="tab-spec" role="tabpanel" aria-labelledby="t-spec" hidden>' +
          '<div class="spec-table-wrap"><table class="spec-table"><tbody>' + specs +
          '<tr><th scope="row">Marca</th><td>' + p.marca + '</td></tr>' +
          '<tr><th scope="row">Código interno</th><td>' + p.sku + '</td></tr>' +
          '<tr><th scope="row">Unidade de venda</th><td>' + p.unidade + '</td></tr>' +
          '</tbody></table></div></div>' +
        '<div class="tabpanel" id="tab-ent" role="tabpanel" aria-labelledby="t-ent" hidden>' +
          '<p class="muted">Entrega para Curitiba e região metropolitana em até 3 dias úteis. Frete grátis acima de ' +
          VM.money(window.VMCart.FRETE_GRATIS) + '. Retirada na loja sem custo, disponível a partir de 2 horas após a confirmação. ' +
          'Trocas e devoluções em até 7 dias corridos após o recebimento, conforme o Código de Defesa do Consumidor.</p></div>' +
      '</div>' +
    '</div>';

    /* quantidade */
    var qtd = VM.qs('#pdp-qtd');
    VM.qs('#qtd-menos').addEventListener('click', function () { qtd.value = Math.max(1, (parseInt(qtd.value, 10) || 1) - 1); });
    VM.qs('#qtd-mais').addEventListener('click', function () {
      qtd.value = Math.min(parseInt(qtd.max, 10), (parseInt(qtd.value, 10) || 1) + 1);
    });

    /* troca de vista na galeria (fallback SVG) */
    VM.qsa('[data-vista-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-vista-btn');
        VM.qsa('[data-vista-btn]').forEach(function (x) {
          x.setAttribute('aria-current', String(x === b));
        });
        VM.qsa('.pdp__view').forEach(function (v) {
          v.hidden = v.getAttribute('data-vista') !== id;
        });
      });
    });

    /* troca de foto na galeria (imagens reais) */
    VM.qsa('[data-foto-idx]').forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = parseInt(b.getAttribute('data-foto-idx'), 10);
        var url = p.imagens[idx];
        if (!url) return;
        var main = VM.qs('#pdp-foto');
        if (main) { main.src = url; main.alt = p.nome; }
        VM.qsa('[data-foto-idx]').forEach(function (x) {
          x.setAttribute('aria-current', String(x === b));
        });
      });
    });

    /* tabs */
    VM.qsa('.tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        VM.qsa('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', 'false'); });
        VM.qsa('.tabpanel').forEach(function (x) { x.hidden = true; });
        b.setAttribute('aria-selected', 'true');
        VM.qs('#' + b.getAttribute('aria-controls')).hidden = false;
      });
    });

    /* simulador de frete (mock) */
    VM.qs('#cep').addEventListener('input', function () {
      var v = this.value.replace(/\D/g, '').slice(0, 8);
      this.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
    });

    VM.qs('#cep-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = VM.qs('#cep').value.replace(/\D/g, '');
      var res = VM.qs('#cep-result');
      if (v.length !== 8) {
        res.innerHTML = '<p class="err" style="display:flex;color:var(--danger);font-size:13px;font-weight:600">' +
          'Informe os 8 dígitos do CEP.</p>';
        return;
      }
      var curitiba = v.indexOf('8') === 0;
      res.innerHTML =
        '<div class="cep-result">' +
          '<div class="cep-result__row"><span>Retirada na loja (Portão)</span><b>Grátis · hoje</b></div>' +
          (curitiba
            ? '<div class="cep-result__row"><span>Entrega VM Click - Curitiba e região</span><b>' + VM.money(24.90) + ' · 1 a 3 dias úteis</b></div>'
            : '<div class="cep-result__row"><span>Transportadora</span><b>' + VM.money(58.40) + ' · 5 a 9 dias úteis</b></div>') +
          '<div class="cep-result__row"><span>Acima de ' + VM.money(window.VMCart.FRETE_GRATIS) + '</span><b>Frete grátis</b></div>' +
        '</div>';
      /* o resultado nasce depois do boot: entra em cascata como as demais listas */
      if (window.VMAnim && VMAnim.listas) VMAnim.listas(res);
    });

    /* avaliações */
    VM.renderAvaliacoes('#avaliacoes', p);

    /* relacionados */
    var rel = VM.produtos().filter(function (x) { return x.cat === p.cat && x.slug !== p.slug; }).slice(0, 4);
    VM.renderProdutos('#relacionados', rel);
  };

  /* ======================================================================
     3.1 AVALIAÇÕES
     Conteúdo de demonstração, gerado a partir do código do produto para ficar
     estável entre recarregamentos. Na loja real vem das avaliações do
     WooCommerce (comentários do CPT product). O bloco é rotulado como
     demonstração na interface para não passar por opinião de cliente real.
     ====================================================================== */
  function semente(txt) {
    var h = 2166136261;
    for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      var t = Math.imul(h ^ (h >>> 15), 1 | h);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var NOMES = [
    'Ricardo A.', 'Juliana M.', 'Fernando P.', 'Camila R.', 'Anderson S.', 'Patrícia L.',
    'Marcos V.', 'Eduarda T.', 'Cláudio B.', 'Simone F.', 'Rodrigo N.', 'Vanessa C.',
    'Gilberto O.', 'Tatiane D.', 'Wagner K.', 'Larissa H.'
  ];

  /* Rótulos de uso, não de pessoa: descrevem o contexto da compra e evitam
     supor gênero ou profissão de quem avaliou. */
  var PERFIS = [
    'Instalação elétrica', 'Uso doméstico', 'Obra residencial', 'Manutenção predial',
    'Reforma', 'Projeto de iluminação', 'Uso profissional', 'Pequeno reparo'
  ];

  var COMENTARIOS = {
    eletrica: [
      'Encaixou no trilho sem folga e o acabamento é firme. Comprei mais três para completar o quadro.',
      'Produto original, com a marcação de norma na peça. Chegou embalado direitinho.',
      'Uso em instalação residencial todo dia. Não tive nenhum retorno de cliente até agora.',
      'Bitola confere com o que está na descrição. O rolo veio lacrado.'
    ],
    iluminacao: [
      'A luz ficou bem branca, do jeito que eu queria na cozinha. Acende na hora, sem piscar.',
      'Troquei quatro pontos da sala e a conta caiu no mês seguinte. Vale a pena.',
      'Bom fluxo de luz para o tamanho. Instalei no forro de gesso e ficou alinhado.',
      'Já tinha comprado a de 9W antes. Essa aqui ilumina bem mais, como esperado.'
    ],
    hidraulica: [
      'Serviu certinho no reparo do banheiro. Vedou de primeira, sem vazamento.',
      'Material com boa espessura de parede, não é aquele fino que amassa na hora de encaixar.',
      'Usei numa troca de coluna inteira. Nenhuma peça veio com defeito.',
      'Rosca bem feita, apertou sem forçar. Recomendo para quem trabalha na área.'
    ],
    utilidades: [
      'Ferramenta firme, o isolamento passa segurança de verdade no trabalho energizado.',
      'Corte limpo e a mola voltou bem depois de meses de uso diário.',
      'Cabo anatômico ajuda muito em serviço longo. Não escorrega com a mão suada.',
      'Custo benefício muito bom para quem usa profissionalmente.'
    ],
    pintura: [
      'Rendimento melhor do que eu esperava. Cobriu em duas demãos numa parede escura.',
      'Secou rápido e não deixou marca de rolo. Acabamento uniforme.',
      'Comprei para a obra inteira e sobrou. A cor ficou igual à da amostra.',
      'Cheiro fraco e fácil de aplicar. Serviu bem para quem não é profissional.'
    ]
  };

  var GERAIS = [
    'Entrega no prazo e o pessoal da loja ajudou a escolher a bitola certa antes de fechar.',
    'Atendimento técnico fez diferença: me pouparam de comprar o item errado.',
    'Retirei na loja no mesmo dia. Produto conferido na hora, com nota fiscal.',
    'Preço competitivo comparando com outras lojas da região.',
    'Segunda compra aqui. Continua o mesmo padrão de embalagem e conferência.'
  ];

  function distribuicao(nota, total) {
    var pesos = [];
    var soma = 0;
    for (var s = 1; s <= 5; s++) {
      var w = Math.exp(-Math.abs(s - nota) * 1.9);
      pesos.push(w); soma += w;
    }
    var contagens = pesos.map(function (w) { return Math.round((w / soma) * total); });
    /* ajusta o arredondamento na estrela mais votada */
    var dif = total - contagens.reduce(function (a, b) { return a + b; }, 0);
    var maior = contagens.indexOf(Math.max.apply(null, contagens));
    contagens[maior] += dif;
    return contagens;
  }

  function estrelasHTML(nota, classe) {
    var out = '';
    for (var i = 1; i <= 5; i++) out += VM.icon('estrela', i <= Math.round(nota) ? '' : 'off');
    return '<span class="' + (classe || 'stars') + '">' + out + '</span>';
  }

  VM.renderAvaliacoes = function (sel, p) {
    var el = VM.qs(sel);
    if (!el) return;

    var rnd = semente(p.sku);
    var dist = distribuicao(p.nota, p.avaliacoes);
    var maxDist = Math.max.apply(null, dist);
    var pool = (COMENTARIOS[p.cat] || []).concat(GERAIS);

    var quantos = Math.min(4, pool.length);
    var usados = {};
    var lista = [];

    for (var i = 0; i < quantos; i++) {
      var idx;
      do { idx = Math.floor(rnd() * pool.length); } while (usados[idx]);
      usados[idx] = true;

      var nota = i === quantos - 1 && p.nota < 4.9
        ? Math.max(3, Math.round(p.nota) - 1)
        : Math.min(5, Math.round(p.nota + (rnd() > 0.7 ? 0 : 0.4)));

      var meses = 1 + Math.floor(rnd() * 10);
      lista.push({
        nome: NOMES[Math.floor(rnd() * NOMES.length)],
        perfil: PERFIS[Math.floor(rnd() * PERFIS.length)],
        nota: nota,
        quando: meses === 1 ? 'há 1 mês' : 'há ' + meses + ' meses',
        texto: pool[idx]
      });
    }

    var barras = '';
    for (var s = 5; s >= 1; s--) {
      var n = dist[s - 1];
      var pct = maxDist ? Math.round((n / p.avaliacoes) * 100) : 0;
      barras +=
        '<div class="rv-bar">' +
          '<span class="rv-bar__k">' + s + VM.icon('estrela') + '</span>' +
          '<span class="rv-bar__t"><span style="width:' + pct + '%"></span></span>' +
          '<span class="rv-bar__n num">' + n + '</span>' +
        '</div>';
    }

    el.innerHTML =
    '<div class="rv">' +
      '<div class="rv__resumo">' +
        '<div class="rv__media">' +
          '<span class="rv__nota num">' + p.nota.toFixed(1).replace('.', ',') + '</span>' +
          estrelasHTML(p.nota, 'stars rv__stars') +
          '<span class="rv__total">' + p.avaliacoes + ' avaliações</span>' +
        '</div>' +
        '<div class="rv__barras">' + barras + '</div>' +
        '<button class="btn btn--outline btn--sm" type="button" id="rv-avaliar">Avaliar este produto</button>' +
      '</div>' +

      '<ul class="rv__lista">' +
        lista.map(function (a) {
          return '<li class="rv__item">' +
            '<span class="rv__av" aria-hidden="true">' + a.nome.charAt(0) + '</span>' +
            '<div class="rv__corpo">' +
              '<div class="rv__cab">' +
                '<b>' + a.nome + '</b>' +
                '<span class="rv__perfil">' + a.perfil + '</span>' +
                '<span class="rv__quando">' + a.quando + '</span>' +
              '</div>' +
              estrelasHTML(a.nota, 'stars rv__item-stars') +
              '<p>' + a.texto + '</p>' +
            '</div>' +
          '</li>';
        }).join('') +
      '</ul>' +

      '<p class="mono subtle rv__aviso">Avaliações de demonstração, geradas para ilustrar a interface. ' +
      'Na loja real este bloco é alimentado pelas avaliações dos clientes no WooCommerce.</p>' +
    '</div>';

    var btn = VM.qs('#rv-avaliar');
    if (btn) btn.addEventListener('click', function () {
      VM.toast('Envio de avaliação entra na fase 2, junto com a área do cliente.', 'warn');
    });
  };

  /* ======================================================================
     4. BLOCOS DA HOME
     ====================================================================== */
  VM.renderCategorias = function (sel) {
    var el = VM.qs(sel);
    if (!el) return;
    el.innerHTML = VM.categorias().map(function (c) {
      var n = VM.produtos().filter(function (p) { return p.cat === c.slug; }).length;
      return '<a class="cat-card" href="categoria.html?cat=' + c.slug + '">' +
        VM.ico(c.icone, 'cat-card__ico') +
        '<h3>' + c.nome + '</h3>' +
        '<p>' + c.desc + '</p>' +
        '<span class="cat-card__n">' + n + ' itens nesta demonstração</span>' +
        '<span class="cat-card__link">Ver produtos' + VM.icon('seta') + '</span>' +
      '</a>';
    }).join('') +
    '<a class="cat-card cat-card--servico" href="servicos.html">' +
      VM.ico('p-projeto', 'cat-card__ico') +
      '<span class="cat-card__tag">Serviço</span>' +
      '<h3>Projetos e serviços</h3>' +
      '<p>Setor de design responsável por projetos de lighting design e consultoria de iluminação, com equipe parceira para instalação elétrica e hidráulica.</p>' +
      '<span class="cat-card__n">Orçamento sob medida</span>' +
      '<span class="cat-card__link">Conhecer serviços' + VM.icon('seta') + '</span>' +
    '</a>';
  };

  VM.renderDestaques = function (sel) {
    var lista = VM.produtos().filter(function (p) { return p.destaque && p.estoque > 0; }).slice(0, 8);
    VM.renderProdutos(sel, lista);
  };

  VM.renderOfertas = function (sel) {
    var lista = VM.produtos().filter(function (p) { return p.precoDe && p.estoque > 0; }).slice(0, 4);
    VM.renderProdutos(sel, lista);
  };
})();

