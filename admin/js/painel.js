/* ==========================================================================
   VM Click - painel administrativo

   COMO AS ALTERAÇÕES CHEGAM AO SITE
   O painel edita um rascunho. Ao clicar em "Publicar alterações", o servidor
   busca os dados atualizados no Olist, monta os arquivos de conteúdo do site e
   grava no repositório; a Vercel reconstrói sozinha em seguida.

   Quem opera não baixa arquivo nem abre terminal: clica e publica.

   O rascunho fica no navegador (localStorage) até ser publicado, então dá para
   mexer aos poucos sem perder o que já foi feito.
   ========================================================================== */
(function () {
  'use strict';

  var CHAVE = 'vmclick.painel.rascunho';

  /* ====================================================================== */
  /* 1. ESTADO                                                              */
  /* ====================================================================== */

  var catalogo = window.VM_PRODUTOS || [];
  var estado = carregar();

  function padrao() {
    var cur = window.VM_CURADORIA || { destaques: [], ofertas: [] };
    return {
      skus: catalogo.map(function (p) { return p.sku; }),
      destaques: (cur.destaques || []).slice(),
      ofertas: (cur.ofertas || []).map(function (o) { return { sku: o.sku, precoDe: o.precoDe }; }),
      /* produtos trazidos do Olist nesta sessão e ainda não sincronizados */
      novos: [],
      banners: (window.VM_BANNERS || []).map(function (b) { return Object.assign({}, b); }),
      posts: (window.VM_POSTS || []).map(function (p) { return Object.assign({}, p); }),
    };
  }

  function carregar() {
    try {
      var bruto = localStorage.getItem(CHAVE);
      if (!bruto) return padrao();
      var salvo = JSON.parse(bruto);
      return Object.assign(padrao(), salvo);
    } catch (e) {
      return padrao();
    }
  }

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) {
      aviso('Não consegui salvar o rascunho neste navegador.', true);
    }
  }

  /* ====================================================================== */
  /* 2. UTILITÁRIOS DE TELA                                                 */
  /* ====================================================================== */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function moeda(v) { return BRL.format(Number(v) || 0); }
  function esc(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function aviso(msg, erro) {
    var caixa = $('#toasts');
    var t = document.createElement('div');
    t.className = 'toast-admin' + (erro ? ' toast-admin--erro' : '');
    t.textContent = msg;
    caixa.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  /* ---- modal ---- */
  function abrirModal(titulo, html) {
    $('#modal-titulo').textContent = titulo;
    $('#modal-corpo').innerHTML = html;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function fecharModal() {
    $('#modal').hidden = true;
    $('#modal-corpo').innerHTML = '';
    document.body.style.overflow = '';
  }
  $$('[data-fechar]').forEach(function (b) { b.addEventListener('click', fecharModal); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#modal').hidden) fecharModal();
  });

  /* ====================================================================== */
  /* 3. ABAS                                                                */
  /* ====================================================================== */

  $$('.abas button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.abas button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      $$('.tela').forEach(function (t) { t.hidden = t.id !== 'tela-' + b.dataset.tela; });
    });
  });

  /* ====================================================================== */
  /* 4. TELA: PRODUTOS                                                      */
  /* ====================================================================== */

  function produtoPorSku(sku) {
    return catalogo.filter(function (p) { return p.sku === sku; })[0] ||
           estado.novos.filter(function (p) { return p.sku === sku; })[0] || null;
  }

  function ofertaDe(sku) {
    return estado.ofertas.filter(function (o) { return o.sku === sku; })[0] || null;
  }

  function temFrete(p) {
    var s = p.specs || {};
    var peso = parseFloat(String(s['Peso bruto'] || s['Peso líquido'] || '').replace(',', '.'));
    var temMedida = Boolean(s['Largura'] && s['Altura'] && s['Comprimento']);
    if (p.prontoParaFrete != null) return p.prontoParaFrete;
    return Boolean(peso) && temMedida;
  }

  function renderProdutos() {
    var corpo = $('#lista-produtos');
    var linhas = estado.skus.map(function (sku) {
      var p = produtoPorSku(sku);
      if (!p) {
        return '<tr><td colspan="8"><span class="sku">' + esc(sku) + '</span> ' +
               '<span class="selo selo--aviso">aguardando sincronização</span></td></tr>';
      }
      var destaque = estado.destaques.indexOf(sku) > -1;
      var oferta = ofertaDe(sku);
      var frete = temFrete(p);

      return '<tr data-sku="' + esc(sku) + '">' +
        '<td><span class="nome">' + esc(p.nome) + '</span><br><span class="sku">' + esc(sku) + '</span></td>' +
        '<td>' + esc(p.marca || '—') + '</td>' +
        '<td class="num">' + moeda(p.preco) + '</td>' +
        '<td class="num">' + (p.estoque != null ? p.estoque : '—') + '</td>' +
        '<td>' + (frete
          ? '<span class="selo selo--ok">ok</span>'
          : '<span class="selo selo--alerta">sem peso</span>') + '</td>' +
        '<td><input type="checkbox" data-destaque' + (destaque ? ' checked' : '') + '></td>' +
        '<td>' + (oferta
          ? '<input type="number" step="0.01" min="0" value="' + oferta.precoDe + '" data-precode style="width:96px">'
          : '<button class="bt bt--mini bt--linha" type="button" data-add-oferta>Definir</button>') + '</td>' +
        '<td><button class="bt bt--mini bt--perigo" type="button" data-remover>Tirar do site</button></td>' +
      '</tr>';
    }).join('');

    corpo.innerHTML = linhas || '<tr><td colspan="8"><div class="vazio">Nenhum produto no site. Use “Buscar no Olist” para adicionar.</div></td></tr>';
    $('#conta-produtos').textContent = estado.skus.length;

    var semFrete = estado.skus.filter(function (s) {
      var p = produtoPorSku(s); return p && !temFrete(p);
    }).length;

    var resumo = $('#resumo-produtos');
    if (semFrete) {
      resumo.className = 'aviso aviso--alerta';
      resumo.innerHTML = '<b>' + semFrete + ' de ' + estado.skus.length + ' produtos estão sem peso ou sem medidas no Olist.</b> ' +
        'Enquanto isso não for corrigido lá, o frete desses itens não pode ser calculado e eles não conseguem ser vendidos.';
    } else {
      resumo.className = 'aviso';
      resumo.innerHTML = '<b>Todos os produtos têm peso e medidas.</b> O frete consegue ser calculado para o catálogo inteiro.';
    }
  }

  $('#lista-produtos').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-sku]');
    if (!tr) return;
    var sku = tr.dataset.sku;

    if (e.target.matches('[data-remover]')) {
      estado.skus = estado.skus.filter(function (s) { return s !== sku; });
      estado.destaques = estado.destaques.filter(function (s) { return s !== sku; });
      estado.ofertas = estado.ofertas.filter(function (o) { return o.sku !== sku; });
      salvar(); renderProdutos();
      aviso('Produto tirado do site. Publique para valer no ar.');
    }

    if (e.target.matches('[data-add-oferta]')) {
      var p = produtoPorSku(sku);
      var sugerido = p ? (Math.round(p.preco * 1.25 * 100) / 100) : 0;
      estado.ofertas.push({ sku: sku, precoDe: sugerido });
      salvar(); renderProdutos();
    }
  });

  $('#lista-produtos').addEventListener('change', function (e) {
    var tr = e.target.closest('tr[data-sku]');
    if (!tr) return;
    var sku = tr.dataset.sku;

    if (e.target.matches('[data-destaque]')) {
      if (e.target.checked) {
        if (estado.destaques.indexOf(sku) === -1) estado.destaques.push(sku);
      } else {
        estado.destaques = estado.destaques.filter(function (s) { return s !== sku; });
      }
      salvar();
    }

    if (e.target.matches('[data-precode]')) {
      var valor = parseFloat(e.target.value);
      var p = produtoPorSku(sku);
      var oferta = ofertaDe(sku);
      if (!oferta) return;

      /* preço "de" tem de ser maior que o preço atual, senão o desconto é
         mentira — e anunciar desconto que não existe é infração ao CDC */
      if (!valor || (p && valor <= p.preco)) {
        aviso('O preço anterior precisa ser maior que o preço atual. Desconto que não existiu é propaganda enganosa.', true);
        e.target.value = oferta.precoDe;
        return;
      }
      oferta.precoDe = valor;
      salvar();
    }
  });

  /* ---- buscar no Olist ---- */
  $('#abrir-olist').addEventListener('click', function () {
    abrirModal('Buscar produtos no Olist',
      '<div class="campo"><label for="q-olist">Nome, código ou marca</label>' +
      '<div class="busca-linha"><input id="q-olist" type="search" placeholder="ex.: lâmpada led bulbo" autofocus>' +
      '<button class="bt bt--principal" type="button" id="fazer-busca">Buscar</button></div>' +
      '<span class="dica">A busca vai direto no seu Olist, com o catálogo e os preços de agora.</span></div>' +
      '<div id="res-olist" style="margin-top:16px"></div>');

    $('#fazer-busca').addEventListener('click', buscar);
    $('#q-olist').addEventListener('keydown', function (e) { if (e.key === 'Enter') buscar(); });
  });

  function buscar() {
    var termo = $('#q-olist').value.trim();
    var alvo = $('#res-olist');
    alvo.innerHTML = '<div class="vazio">Buscando no Olist…</div>';

    API.buscarProdutos(termo, 0)
      .then(function (r) {
        if (!r.itens.length) {
          alvo.innerHTML = '<div class="vazio">Nada encontrado para <b>' + esc(termo) + '</b>.</div>';
          return;
        }
        alvo.innerHTML =
          '<div class="cartao__titulo">Resultados <span class="conta">' + r.itens.length + ' de ' + r.total + '</span></div>' +
          '<div class="tab-wrap"><table class="dados" style="min-width:0">' +
          '<thead><tr><th>Produto</th><th class="num">Preço</th><th></th></tr></thead><tbody>' +
          r.itens.map(function (p) {
            var jaTem = estado.skus.indexOf(p.sku) > -1;
            return '<tr>' +
              '<td><span class="nome">' + esc(p.nome) + '</span><br><span class="sku">' + esc(p.sku || 'sem código') + '</span></td>' +
              '<td class="num">' + moeda(p.preco) + '</td>' +
              '<td>' + (jaTem
                ? '<span class="selo selo--teal">já está no site</span>'
                : '<button class="bt bt--mini bt--principal" type="button" data-incluir="' + p.id + '" data-sku="' + esc(p.sku) + '">Incluir</button>') +
              '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      })
      .catch(function (err) {
        alvo.innerHTML = '<div class="aviso aviso--erro">' + esc(err.message) + '</div>';
      });
  }

  document.addEventListener('click', function (e) {
    var bt = e.target.closest('[data-incluir]');
    if (!bt) return;
    bt.disabled = true;
    bt.textContent = 'Conferindo…';

    API.detalheProduto(bt.dataset.incluir)
      .then(function (p) {
        if (!p.sku) throw new Error('Este produto não tem código (SKU) no Olist. Cadastre um antes de publicar.');
        estado.skus.push(p.sku);
        estado.novos.push({
          sku: p.sku, nome: p.nome, marca: p.marca, preco: p.preco,
          estoque: p.estoque, prontoParaFrete: p.prontoParaFrete,
        });
        salvar(); renderProdutos();

        bt.outerHTML = '<span class="selo selo--teal">incluído</span>';
        aviso(p.prontoParaFrete
          ? p.nome.slice(0, 40) + ' incluído.'
          : 'Incluído, mas está sem peso ou medidas no Olist — o frete não fecha assim.', !p.prontoParaFrete);
      })
      .catch(function (err) {
        bt.disabled = false;
        bt.textContent = 'Incluir';
        aviso(err.message, true);
      });
  });

  /* ====================================================================== */
  /* 5. TELA: BANNERS                                                       */
  /* ====================================================================== */

  function renderBanners() {
    var alvo = $('#lista-banners');
    if (!estado.banners.length) {
      alvo.innerHTML = '<div class="vazio">Nenhum banner. O carrossel some da home enquanto estiver vazio.</div>';
      return;
    }
    alvo.innerHTML = estado.banners.map(function (b, i) {
      return '<div class="item' + (b.ativo === false ? ' inativo' : '') + '" data-i="' + i + '">' +
        '<div class="item__ordem">' +
          '<button type="button" data-sobe' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir">▲</button>' +
          '<button type="button" data-desce' + (i === estado.banners.length - 1 ? ' disabled' : '') + ' aria-label="Descer">▼</button>' +
        '</div>' +
        '<div class="item__corpo" style="display:flex;gap:14px;align-items:center">' +
          '<img class="miniatura" src="/' + esc(b.img) + '-800.jpg" alt="" onerror="this.style.visibility=\'hidden\'">' +
          '<span><b>' + esc(b.titulo) + '</b><span>' + esc(b.link) + '</span></span>' +
        '</div>' +
        '<div class="item__acoes">' +
          '<button class="bt bt--mini bt--linha" type="button" data-editar>Editar</button>' +
          '<button class="bt bt--mini bt--linha" type="button" data-ativo>' + (b.ativo === false ? 'Ativar' : 'Desativar') + '</button>' +
          '<button class="bt bt--mini bt--perigo" type="button" data-excluir>Excluir</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function formBanner(b, i) {
    b = b || { titulo: '', link: '', img: 'assets/img/banners/', alt: '', ativo: true };
    abrirModal(i == null ? 'Novo banner' : 'Editar banner',
      '<div class="campo"><label for="b-titulo">Título interno</label>' +
        '<input id="b-titulo" value="' + esc(b.titulo) + '" placeholder="Promoção em iluminação">' +
        '<span class="dica">Não aparece para o cliente. Serve para você identificar aqui.</span></div>' +
      '<div class="campo" style="margin-top:12px"><label for="b-link">Para onde leva</label>' +
        '<input id="b-link" value="' + esc(b.link) + '" placeholder="categoria.html?cat=iluminacao-led"></div>' +
      '<div class="campo" style="margin-top:12px"><label for="b-img">Caminho da imagem</label>' +
        '<input id="b-img" value="' + esc(b.img) + '" placeholder="assets/img/banners/promo-natal">' +
        '<span class="dica">Sem o tamanho e sem a extensão. O site completa com -800.jpg, -1920.webp e assim por diante.</span></div>' +
      '<div class="campo" style="margin-top:12px"><label for="b-alt">Descrição da imagem</label>' +
        '<textarea id="b-alt" placeholder="Promoção em iluminação: LED a partir de R$ 19,90">' + esc(b.alt) + '</textarea>' +
        '<span class="dica">Lida por quem usa leitor de tela e mostrada se a imagem não carregar.</span></div>' +
      '<div class="bt-linha" style="margin-top:18px"><button class="bt bt--principal" type="button" id="salvar-banner">Salvar</button>' +
        '<button class="bt bt--linha" type="button" data-fechar>Cancelar</button></div>');

    $('#salvar-banner').addEventListener('click', function () {
      var novo = {
        titulo: $('#b-titulo').value.trim(),
        link: $('#b-link').value.trim(),
        img: $('#b-img').value.trim().replace(/\.(jpg|jpeg|png|webp)$/i, '').replace(/-(800|1920)$/, ''),
        alt: $('#b-alt').value.trim(),
        ativo: b.ativo !== false,
      };
      if (!novo.titulo || !novo.link || !novo.img) {
        return aviso('Preencha título, link e caminho da imagem.', true);
      }
      if (!novo.alt) return aviso('A descrição da imagem é obrigatória: sem ela o banner fica inacessível.', true);

      if (i == null) estado.banners.push(novo); else estado.banners[i] = novo;
      salvar(); renderBanners(); fecharModal();
      aviso('Banner salvo no rascunho. Publique para ir ao ar.');
    });
    $$('#modal [data-fechar]').forEach(function (x) { x.addEventListener('click', fecharModal); });
  }

  $('#novo-banner').addEventListener('click', function () { formBanner(null, null); });

  $('#lista-banners').addEventListener('click', function (e) {
    var item = e.target.closest('.item');
    if (!item) return;
    var i = Number(item.dataset.i);

    if (e.target.matches('[data-sobe]')) { troca(estado.banners, i, i - 1); }
    else if (e.target.matches('[data-desce]')) { troca(estado.banners, i, i + 1); }
    else if (e.target.matches('[data-ativo]')) { estado.banners[i].ativo = estado.banners[i].ativo === false; }
    else if (e.target.matches('[data-editar]')) { return formBanner(estado.banners[i], i); }
    else if (e.target.matches('[data-excluir]')) {
      if (!confirm('Excluir o banner "' + estado.banners[i].titulo + '"?')) return;
      estado.banners.splice(i, 1);
    } else return;

    salvar(); renderBanners();
  });

  function troca(lista, a, b) {
    if (b < 0 || b >= lista.length) return;
    var t = lista[a]; lista[a] = lista[b]; lista[b] = t;
  }

  /* ====================================================================== */
  /* 6. TELA: BLOG                                                          */
  /* ====================================================================== */

  function renderBlog() {
    var alvo = $('#lista-blog');
    if (!estado.posts.length) {
      alvo.innerHTML = '<div class="vazio">Nenhum artigo no índice.</div>';
      return;
    }
    alvo.innerHTML = estado.posts.map(function (p, i) {
      return '<div class="item" data-i="' + i + '">' +
        '<div class="item__ordem">' +
          '<button type="button" data-sobe' + (i === 0 ? ' disabled' : '') + ' aria-label="Subir">▲</button>' +
          '<button type="button" data-desce' + (i === estado.posts.length - 1 ? ' disabled' : '') + ' aria-label="Descer">▼</button>' +
        '</div>' +
        '<div class="item__corpo">' +
          '<b>' + esc(p.titulo) + '</b>' +
          '<span>' + esc(p.categoria || 'sem categoria') + ' · ' + esc(p.data || 'sem data') +
            ' · ' + esc(p.leitura || '') + ' · <code>' + esc(p.slug) + '</code></span>' +
        '</div>' +
        '<div class="item__acoes">' +
          '<a class="bt bt--mini bt--linha" href="/' + esc(p.slug) + '" target="_blank" rel="noopener">Ver</a>' +
          '<button class="bt bt--mini bt--linha" type="button" data-editar>Editar</button>' +
          '<button class="bt bt--mini bt--perigo" type="button" data-excluir>Excluir</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function formPost(p, i) {
    p = p || { slug: '', titulo: '', resumo: '', categoria: '', data: new Date().toISOString().slice(0, 10), leitura: '', capa: { peq: '', grd: '' }, alt: '' };
    var capa = p.capa || { peq: '', grd: '' };
    abrirModal(i == null ? 'Novo artigo' : 'Editar artigo',
      '<div class="campo"><label for="p-titulo">Título</label><input id="p-titulo" value="' + esc(p.titulo) + '"></div>' +
      '<div class="campo" style="margin-top:12px"><label for="p-slug">Arquivo do artigo</label>' +
        '<input id="p-slug" value="' + esc(p.slug) + '" placeholder="blog-como-escolher-cabo.html">' +
        '<span class="dica">O texto do artigo mora neste arquivo HTML, na raiz do projeto. Duplique um existente para começar.</span></div>' +
      '<div class="campo" style="margin-top:12px"><label for="p-resumo">Chamada</label>' +
        '<textarea id="p-resumo">' + esc(p.resumo) + '</textarea>' +
        '<span class="dica">Aparece na listagem do blog e é o que convence a clicar.</span></div>' +
      '<div class="campo-linha campo-linha--2" style="margin-top:12px">' +
        '<div class="campo"><label for="p-cat">Categoria</label><input id="p-cat" value="' + esc(p.categoria) + '" placeholder="Elétrica"></div>' +
        '<div class="campo"><label for="p-data">Data</label><input id="p-data" type="date" value="' + esc(p.data) + '"></div>' +
      '</div>' +
      '<div class="campo-linha campo-linha--2" style="margin-top:12px">' +
        '<div class="campo"><label for="p-leitura">Tempo de leitura</label><input id="p-leitura" value="' + esc(p.leitura) + '" placeholder="8 min"></div>' +
        '<div class="campo"><label for="p-capa">Imagem de capa</label><input id="p-capa" value="' + esc(capa.peq.replace(/-900$/, '')) + '" placeholder="assets/img/loja/painel"></div>' +
      '</div>' +
      '<div class="campo" style="margin-top:12px"><label for="p-alt">Descrição da capa</label>' +
        '<textarea id="p-alt">' + esc(p.alt) + '</textarea></div>' +
      '<div class="bt-linha" style="margin-top:18px"><button class="bt bt--principal" type="button" id="salvar-post">Salvar</button>' +
        '<button class="bt bt--linha" type="button" data-fechar>Cancelar</button></div>');

    $('#salvar-post').addEventListener('click', function () {
      var base = $('#p-capa').value.trim().replace(/-(900|1600)$/, '');
      var novo = {
        slug: $('#p-slug').value.trim(),
        titulo: $('#p-titulo').value.trim(),
        resumo: $('#p-resumo').value.trim(),
        categoria: $('#p-cat').value.trim(),
        data: $('#p-data').value,
        leitura: $('#p-leitura').value.trim(),
        capa: base ? { peq: base + '-900', grd: base + '-1600' } : null,
        alt: $('#p-alt').value.trim(),
      };
      if (!novo.titulo || !novo.slug) return aviso('Título e arquivo do artigo são obrigatórios.', true);
      if (!/\.html?$/.test(novo.slug)) return aviso('O arquivo do artigo precisa terminar em .html', true);

      if (i == null) estado.posts.unshift(novo); else estado.posts[i] = novo;
      salvar(); renderBlog(); fecharModal();
      aviso('Artigo salvo no rascunho. Publique para ir ao ar.');
    });
    $$('#modal [data-fechar]').forEach(function (x) { x.addEventListener('click', fecharModal); });
  }

  $('#novo-post').addEventListener('click', function () { formPost(null, null); });

  $('#lista-blog').addEventListener('click', function (e) {
    var item = e.target.closest('.item');
    if (!item) return;
    var i = Number(item.dataset.i);

    if (e.target.matches('[data-sobe]')) { troca(estado.posts, i, i - 1); }
    else if (e.target.matches('[data-desce]')) { troca(estado.posts, i, i + 1); }
    else if (e.target.matches('[data-editar]')) { return formPost(estado.posts[i], i); }
    else if (e.target.matches('[data-excluir]')) {
      if (!confirm('Tirar "' + estado.posts[i].titulo + '" do índice do blog?\n\nO arquivo do artigo continua no projeto.')) return;
      estado.posts.splice(i, 1);
    } else return;

    salvar(); renderBlog();
  });

  /* ====================================================================== */
  /* 7. PUBLICAR                                                            */
  /* ====================================================================== */

  /* O operador clica e o servidor faz o resto: monta os arquivos, grava no
     repositório e o site se reconstrói. Nada de baixar arquivo nem abrir
     terminal. */

  var ROTULO_TIPO = {
    produtos: 'produtos do site',
    banners: 'banners da home',
    blog: 'índice do blog',
  };

  function cargaDe(tipo) {
    if (tipo === 'produtos') {
      return { tipo: tipo, skus: estado.skus, destaques: estado.destaques, ofertas: estado.ofertas };
    }
    if (tipo === 'banners') return { tipo: tipo, banners: estado.banners };
    return { tipo: tipo, posts: estado.posts };
  }

  function publicar(tipo, botao) {
    var textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Publicando…';

    abrirModal('Publicando ' + ROTULO_TIPO[tipo],
      '<p style="margin:0;color:var(--text-muted);font-size:14px">' +
        'Buscando os dados atualizados e enviando para o site. ' +
        'Isto leva alguns segundos, não feche a página.</p>' +
      '<div class="vazio" id="status-pub" style="margin-top:16px">Publicando…</div>');

    API.publicar(cargaDe(tipo))
      .then(function (r) {
        var extra = '';
        if (r.naoEncontrados && r.naoEncontrados.length) {
          extra = '<div class="aviso aviso--atencao" style="margin-top:14px">' +
            '<b>' + r.naoEncontrados.length + ' produto(s) não foram encontrados no Olist</b> e ficaram de fora: ' +
            r.naoEncontrados.map(esc).join(', ') + '. Confira o código no Olist.</div>';
        }
        $('#modal-corpo').innerHTML =
          '<div class="aviso"><b>Publicado.</b> ' + r.publicados + ' ' + ROTULO_TIPO[tipo] +
          ' no ar. O site leva cerca de um minuto para atualizar.</div>' + extra +
          '<div class="bt-linha" style="margin-top:16px">' +
            '<a class="bt bt--principal" href="/index.html" target="_blank" rel="noopener">Ver o site</a>' +
            '<button class="bt bt--linha" type="button" data-fechar>Fechar</button></div>';
        $$('#modal [data-fechar]').forEach(function (x) { x.addEventListener('click', fecharModal); });

        /* publicado: o rascunho deixa de ser rascunho */
        estado.novos = [];
        salvar();
        aviso('Publicado com sucesso.');
      })
      .catch(function (err) {
        var ajuda = '';
        if (/não configurada/i.test(err.message)) {
          ajuda = '<p style="margin:12px 0 0;font-size:13.5px;color:var(--text-muted)">' +
            'Avise quem cuida do sistema: falta ligar a publicação automática no servidor.</p>';
        }
        $('#modal-corpo').innerHTML =
          '<div class="aviso aviso--erro">' + esc(err.message) + '</div>' + ajuda +
          '<div class="bt-linha" style="margin-top:16px">' +
            '<button class="bt bt--linha" type="button" data-fechar>Fechar</button></div>';
        $$('#modal [data-fechar]').forEach(function (x) { x.addEventListener('click', fecharModal); });
      })
      .finally(function () {
        botao.disabled = false;
        botao.textContent = textoOriginal;
      });
  }

  $$('[data-publicar]').forEach(function (bt) {
    bt.addEventListener('click', function () { publicar(bt.dataset.publicar, bt); });
  });

  /* ====================================================================== */
  /* 8. BOOT                                                                */
  /* ====================================================================== */

  $('#sair').addEventListener('click', function () {
    API.sair().finally(function () { location.replace('/admin/'); });
  });

  API.sessao().then(function (s) {
    if (!s) { location.replace('/admin/'); return; }
    $('#quem').textContent = s.usuario;
    renderProdutos();
    renderBanners();
    renderBlog();
  });
})();
