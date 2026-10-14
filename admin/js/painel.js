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
    $('#modal-caixa').classList.remove('modal__caixa--largo');
    delete $('#modal-corpo').dataset.pedido;
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
      /* busca a situação toda vez que a aba abre: outra pessoa pode ter
         mudado o modo em outro computador */
      if (b.dataset.tela === 'integracoes') carregarIntegracoes();
      if (b.dataset.tela === 'pedidos') carregarPedidos();
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
  /* 7. TELA: PEDIDOS                                                       */
  /* ====================================================================== */

  /* Os pedidos vêm do servidor a cada abertura da aba e no "Atualizar":
     nada disso passa pelo rascunho nem pelo "Publicar". */

  var listaPedidos = [];
  var filtroPedidos = 'expedir';

  var SITUACAO = {
    aguardando: { t: 'Aguardando pagamento', c: 'selo--neutro' },
    pago:       { t: 'Pago · separar',       c: 'selo--aviso' },
    separacao:  { t: 'Em separação',         c: 'selo--teal' },
    enviado:    { t: 'Enviado',              c: 'selo--teal', retirada: 'Pronto p/ retirar' },
    entregue:   { t: 'Entregue',             c: 'selo--ok', retirada: 'Retirado' },
    vencido:    { t: 'Vencido',              c: 'selo--neutro' },
    cancelado:  { t: 'Cancelado',            c: 'selo--neutro' },
    falhou:     { t: 'Falhou',               c: 'selo--neutro' },
    recusado:   { t: 'Cartão recusado',      c: 'selo--neutro' },
    estornado:  { t: 'Estornado',            c: 'selo--alerta' },
    contestado: { t: 'Contestado',           c: 'selo--alerta' },
  };

  var FILTROS = [
    { id: 'expedir',    t: 'Para expedir',  s: ['pago', 'separacao'] },
    { id: 'aguardando', t: 'Aguardando pagamento', s: ['aguardando'] },
    { id: 'enviados',   t: 'Enviados',      s: ['enviado'] },
    { id: 'entregues',  t: 'Entregues',     s: ['entregue'] },
    { id: 'problemas',  t: 'Estorno/contestação', s: ['estornado', 'contestado'] },
    { id: 'todos',      t: 'Todos',         s: null },
  ];

  var FORMA = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão' };

  function seloSituacao(status, tipoEntrega) {
    var s = SITUACAO[status] || { t: status, c: 'selo--neutro' };
    var texto = tipoEntrega === 'retirada' && s.retirada ? s.retirada : s.t;
    return '<span class="selo ' + s.c + '">' + esc(texto) + '</span>';
  }

  function dataHora(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function renderFiltros() {
    $('#ped-filtros').innerHTML = FILTROS.map(function (f) {
      var n = f.s ? listaPedidos.filter(function (p) { return f.s.indexOf(p.status) !== -1; }).length : listaPedidos.length;
      return '<button type="button" class="ped-filtro" data-filtro="' + f.id + '" aria-pressed="' + (f.id === filtroPedidos) + '">' +
        esc(f.t) + ' <span class="conta">' + n + '</span></button>';
    }).join('');
  }

  function renderPedidos() {
    renderFiltros();
    var f = FILTROS.filter(function (x) { return x.id === filtroPedidos; })[0];
    var termo = ($('#ped-busca').value || '').trim().toLowerCase();
    var visiveis = listaPedidos.filter(function (p) {
      if (f.s && f.s.indexOf(p.status) === -1) return false;
      if (!termo) return true;
      return (p.numero + ' ' + (p.cliente || '')).toLowerCase().indexOf(termo) !== -1;
    });

    if (!visiveis.length) {
      $('#lista-pedidos').innerHTML = '<tr><td colspan="6"><div class="vazio">' +
        (listaPedidos.length ? 'Nenhum pedido neste filtro.' : 'Nenhum pedido ainda. Eles aparecem aqui assim que alguém finaliza uma compra no site.') +
        '</div></td></tr>';
      return;
    }

    $('#lista-pedidos').innerHTML = visiveis.map(function (p) {
      return '<tr class="ped-linha" data-pedido="' + esc(p.id) + '" tabindex="0">' +
        '<td><span class="nome">' + esc(p.numero) + '</span><br><span class="sku">' + esc(dataHora(p.criadoEm)) + '</span></td>' +
        '<td><span class="nome">' + esc(p.cliente) + '</span><br><span class="sku">' + esc(p.local) + '</span></td>' +
        '<td>' + esc(p.entrega || '') + '<br><span class="sku">' + p.itens + (p.itens === 1 ? ' item' : ' itens') + '</span></td>' +
        '<td class="num">' + moeda(p.total) + '<br><span class="sku">' + esc(FORMA[p.forma] || p.forma) + '</span></td>' +
        '<td>' + seloSituacao(p.status, p.tipoEntrega) + '</td>' +
        '<td>' + (p.olist ? '<span class="sku">' + esc(p.olist) + '</span>'
          : (p.olistErro ? '<span class="selo selo--alerta">erro</span>' : '<span class="sku">—</span>')) + '</td>' +
      '</tr>';
    }).join('');
  }

  function carregarPedidos() {
    API.pedidos()
      .then(function (r) {
        listaPedidos = r.pedidos || [];
        /* nada para expedir: abre direto em "Todos" */
        if (filtroPedidos === 'expedir' && !listaPedidos.some(function (p) { return p.status === 'pago' || p.status === 'separacao'; })) {
          filtroPedidos = 'todos';
        }
        renderPedidos();
      })
      .catch(function (err) {
        $('#lista-pedidos').innerHTML = '<tr><td colspan="6"><div class="aviso aviso--erro">' + esc(err.message) + '</div></td></tr>';
      });
  }

  $('#ped-filtros').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filtro]');
    if (!b) return;
    filtroPedidos = b.dataset.filtro;
    renderPedidos();
  });
  $('#ped-busca').addEventListener('input', renderPedidos);
  $('#atualizar-pedidos').addEventListener('click', carregarPedidos);

  function abrirLinha(e) {
    var tr = e.target.closest('[data-pedido]');
    if (!tr) return;
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    abrirPedido(tr.dataset.pedido);
  }
  $('#lista-pedidos').addEventListener('click', abrirLinha);
  $('#lista-pedidos').addEventListener('keydown', abrirLinha);

  /* ---- detalhe ---- */

  function doc(d) {
    d = String(d || '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return d;
  }
  function fone(t) {
    t = String(t || '');
    return t.length === 11 ? t.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3') : t.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  function acoesDe(p) {
    var retirada = p.entrega && p.entrega.opcao && p.entrega.opcao.tipo === 'retirada';
    var b = [];
    if (p.status === 'pago') b.push('<button class="bt bt--linha" type="button" data-acao-pedido="separacao">Iniciar separação</button>');
    if (p.status === 'pago' || p.status === 'separacao') {
      b.push(retirada
        ? '<button class="bt bt--principal" type="button" data-acao-pedido="enviado">Pronto para retirada</button>'
        : '<button class="bt bt--principal" type="button" data-abrir-envio>Marcar como enviado…</button>');
    }
    if (p.status === 'enviado') {
      b.push('<button class="bt bt--principal" type="button" data-acao-pedido="entregue">' + (retirada ? 'Cliente retirou' : 'Marcar como entregue') + '</button>');
    }
    if (p.status === 'aguardando' || p.status === 'vencido') {
      b.push('<button class="bt bt--perigo" type="button" data-acao-pedido="cancelar">Cancelar pedido</button>');
    }
    var pagoOuDepois = ['pago', 'separacao', 'enviado', 'entregue'].indexOf(p.status) !== -1;
    if (pagoOuDepois && !(p.olist && p.olist.id)) {
      b.push('<button class="bt bt--linha" type="button" data-acao-pedido="olist">Enviar ao Olist</button>');
    }
    return b.join('');
  }

  function detalheHTML(p) {
    var e = p.entrega || {};
    var op = e.opcao || {};
    var retirada = op.tipo === 'retirada';
    var c = p.cliente || {};
    var tel = String(c.tel || '');

    var endereco = retirada
      ? 'Retirada na loja (Portão)'
      : esc([e.rua, e.numero].filter(Boolean).join(', ') + (e.compl ? ' - ' + e.compl : '')) + '<br>' +
        esc([e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')) + '<br>CEP ' + esc(String(e.cep || '').replace(/(\d{5})(\d{3})/, '$1-$2'));

    return '' +
    '<div class="ped-topo">' + seloSituacao(p.status, op.tipo) +
      '<span class="sku">Criado em ' + esc(dataHora(p.criadoEm)) + (p.pagoEm ? ' · pago em ' + esc(dataHora(p.pagoEm)) : '') + '</span>' +
    '</div>' +

    (p.olistErro && !(p.olist && p.olist.id)
      ? '<div class="aviso aviso--alerta"><b>Não foi para o Olist.</b> ' + esc(p.olistErro.mensagem) + '</div>'
      : '') +

    '<div class="ped-grade">' +
      '<section><h4>Cliente</h4><p><b>' + esc(c.nome) + '</b><br>' + esc(doc(c.doc)) +
        '<br><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' +
        '<br><a href="https://wa.me/55' + esc(tel) + '" target="_blank" rel="noopener">' + esc(fone(tel)) + '</a></p></section>' +
      '<section><h4>Entrega</h4><p><b>' + esc(op.servico || '') + '</b>' +
        (op.transportadora && op.tipo === 'transportadora' ? ' · ' + esc(op.transportadora) : '') +
        (e.aCombinar ? '<br><span class="selo selo--aviso">frete a combinar</span>' : '') +
        '<br>' + endereco +
        (p.rastreio && (p.rastreio.codigo || p.rastreio.url)
          ? '<br>Rastreio: <b>' + esc(p.rastreio.codigo || '') + '</b>' + (p.rastreio.url ? ' · <a href="' + esc(p.rastreio.url) + '" target="_blank" rel="noopener">abrir</a>' : '')
          : '') +
      '</p></section>' +
      '<section><h4>Pagamento</h4><p><b>' + esc(FORMA[p.forma] || p.forma) + '</b>' + (p.parcelas > 1 ? ' em ' + p.parcelas + 'x' : '') +
        '<br>Olist: ' + (p.olist && p.olist.numero ? '<b>pedido ' + esc(p.olist.numero) + '</b>' : '—') + '</p></section>' +
    '</div>' +

    '<table class="dados ped-itens"><thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Valor</th></tr></thead><tbody>' +
      (p.itens || []).map(function (i) {
        return '<tr><td><span class="nome">' + esc(i.nome) + '</span><br><span class="sku">' + esc(i.sku) + '</span></td>' +
          '<td class="num">' + i.qtd + '</td><td class="num">' + moeda(i.sub) + '</td></tr>';
      }).join('') +
      '<tr><td colspan="2">Frete</td><td class="num">' + (e.aCombinar ? 'a combinar' : moeda(p.frete)) + '</td></tr>' +
      (p.desconto ? '<tr><td colspan="2">Desconto Pix</td><td class="num">− ' + moeda(p.desconto) + '</td></tr>' : '') +
      '<tr class="ped-total"><td colspan="2"><b>Total</b></td><td class="num"><b>' + moeda(p.total) + '</b></td></tr>' +
    '</tbody></table>' +

    '<div id="ped-envio" hidden>' +
      '<div class="campo-linha campo-linha--2">' +
        '<div class="campo"><label for="ped-rastreio">Código de rastreio</label><input id="ped-rastreio" maxlength="60" placeholder="Ex.: AA123456789BR"></div>' +
        '<div class="campo"><label for="ped-rastreio-url">Link de rastreio (opcional)</label><input id="ped-rastreio-url" maxlength="300" placeholder="https://…"></div>' +
      '</div>' +
      '<span class="dica">O cliente vê o código na página do pedido. Também vai para o pedido no Olist.</span>' +
      '<div class="bt-linha" style="margin-top:10px"><button class="bt bt--principal" type="button" data-acao-pedido="enviado">Confirmar envio</button></div>' +
    '</div>' +

    '<div class="bt-linha ped-acoes">' + acoesDe(p) + '</div>' +

    '<details class="ped-historico"><summary>Histórico</summary><ul>' +
      (p.historico || []).map(function (h) {
        return '<li><span class="sku">' + esc(dataHora(h.em)) + '</span> ' + esc((SITUACAO[h.status] || { t: h.status }).t) +
          ' <span class="sku">(' + esc(h.origem) + ')</span></li>';
      }).join('') +
    '</ul></details>' +
    '<p class="ped-msg" data-msg aria-live="polite"></p>';
  }

  function abrirPedido(id) {
    abrirModal('Pedido', '<div class="vazio">Carregando…</div>');
    $('#modal-caixa').classList.add('modal__caixa--largo');
    API.pedido(id)
      .then(function (p) { mostrarPedido(p); })
      .catch(function (err) { $('#modal-corpo').innerHTML = '<div class="aviso aviso--erro">' + esc(err.message) + '</div>'; });
  }

  function mostrarPedido(p) {
    $('#modal-titulo').textContent = 'Pedido ' + p.numero;
    $('#modal-corpo').innerHTML = detalheHTML(p);
    $('#modal-corpo').dataset.pedido = p.id;
  }

  var CONFIRMA = {
    cancelar: 'Cancelar este pedido? A cobrança pendente sai do Asaas e o cliente não consegue mais pagar.',
    entregue: null,
  };

  $('#modal-corpo').addEventListener('click', function (e) {
    var id = $('#modal-corpo').dataset.pedido;
    if (!id) return;

    if (e.target.closest('[data-abrir-envio]')) {
      $('#ped-envio').hidden = false;
      $('#ped-rastreio').focus();
      return;
    }

    var bt = e.target.closest('[data-acao-pedido]');
    if (!bt || bt.disabled) return;
    var acao = bt.dataset.acaoPedido;
    if (CONFIRMA[acao] && !confirm(CONFIRMA[acao])) return;

    var rastreio = null;
    if (acao === 'enviado' && $('#ped-rastreio')) {
      rastreio = { codigo: $('#ped-rastreio').value.trim(), url: $('#ped-rastreio-url').value.trim() };
    }

    var texto = bt.textContent;
    bt.disabled = true;
    bt.textContent = 'Aguarde…';

    API.acaoPedido(id, acao, rastreio)
      .then(function (p) {
        mostrarPedido(p);
        aviso('Pedido ' + p.numero + ' atualizado.');
        carregarPedidos();
      })
      .catch(function (err) {
        bt.disabled = false;
        bt.textContent = texto;
        var msg = $('#modal-corpo [data-msg]');
        if (msg) { msg.textContent = err.message; msg.className = 'ped-msg ped-msg--erro'; }
      });
  });

  /* ====================================================================== */
  /* 7b. TELA: INTEGRAÇÕES                                                  */
  /* ====================================================================== */

  /* Chaves do Asaas e do Melhor Envio, uma por ambiente, e o modo em uso.
     O servidor testa cada chave antes de guardar e nunca devolve a chave:
     aqui só aparece o final dela. Nada disso passa pelo rascunho nem pelo
     "Publicar" - vale na hora. */

  var integ = null;
  var AMBIENTES = ['sandbox', 'producao'];
  var ROTULO_AMB = { sandbox: 'Teste (sandbox)', producao: 'Produção' };

  var INTEG = {
    asaas: {
      dados: function () { return integ.asaas; },
      nome: 'Asaas',
      descricao: 'Pagamento: Pix, boleto e cartão. Em teste, nenhuma compra é cobrada.',
      rotulo: 'Chave da API',
      segredos: function (d) { return d.chaves; },
      placeholder: { sandbox: '$aact_hmlg_…', producao: '$aact_prod_…' },
      onde: {
        sandbox: 'No sandbox.asaas.com: Integrações > Chaves de API > Gerar chave.',
        producao: 'No asaas.com: Integrações > Chaves de API > Gerar chave.',
      },
    },
    melhorenvio: {
      dados: function () { return integ.melhorEnvio; },
      nome: 'Melhor Envio',
      descricao: 'Frete: cotação de Jadlog, Correios e demais transportadoras.',
      rotulo: 'Token',
      segredos: function (d) { return d.tokens; },
      placeholder: { sandbox: 'eyJ0eXAiOiJKV1Qi…', producao: 'eyJ0eXAiOiJKV1Qi…' },
      onde: {
        sandbox: 'No sandbox.melhorenvio.com.br: Integrações > Permissões de acesso > Gerar novo token, com a permissão shipping-calculate.',
        producao: 'No melhorenvio.com.br: Integrações > Permissões de acesso > Gerar novo token, com a permissão shipping-calculate.',
      },
    },
  };

  function data(iso) {
    return iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
  }

  function situacaoSegredo(id, d, amb) {
    var s = INTEG[id].segredos(d)[amb];
    if (s.configurada) {
      return '<span class="selo selo--ok">cadastrada</span><span class="final">' + esc(s.final) + '</span>' +
        (s.em ? '<span class="final">em ' + data(s.em) + '</span>' : '');
    }
    if (id === 'asaas' && d.origemChave === 'ambiente' && d.ambiente === amb) {
      return '<span class="selo selo--neutro">usando a variável do servidor</span>';
    }
    if (id === 'melhorenvio' && d.oauth && d.ambienteOauth === amb) {
      return '<span class="selo selo--neutro">usando a conexão OAuth do servidor</span>';
    }
    return '<span class="selo selo--aviso">não cadastrada</span>';
  }

  function linhaWebhook(d, amb) {
    var w = d.webhook[amb];
    var cadastrada = d.chaves[amb].configurada || (d.origemChave === 'ambiente' && d.ambiente === amb);
    return '<div class="integ-amb__topo">' +
      '<span>Webhook (aviso de pagamento):</span>' +
      (w.configurado
        ? '<span class="selo selo--ok">configurado</span>' + (w.em ? '<span class="final">em ' + data(w.em) + '</span>' : '')
        : '<span class="selo selo--aviso">não configurado</span>') +
      '<button class="bt bt--mini bt--linha" type="button" data-integ="asaas" data-acao="webhook" data-amb="' + amb + '"' +
        (!cadastrada || integ.webhookLocal ? ' disabled' : '') + '>' +
        (w.configurado ? 'Reconfigurar' : 'Configurar automaticamente') + '</button>' +
    '</div>';
  }

  function cartaoIntegracao(id) {
    var cfg = INTEG[id];
    var d = cfg.dados();
    var prod = d.ambiente === 'producao';

    var ambientes = AMBIENTES.map(function (amb) {
      var s = cfg.segredos(d)[amb];
      return '<div class="integ-amb">' +
        '<div class="integ-amb__topo"><b>' + ROTULO_AMB[amb] + '</b>' +
          (d.ambiente === amb ? '<span class="selo selo--teal">em uso</span>' : '') +
          situacaoSegredo(id, d, amb) + '</div>' +
        '<div class="campo">' +
          '<label for="integ-' + id + '-' + amb + '">' + cfg.rotulo + (s.configurada ? ' (substituir)' : '') + '</label>' +
          '<div class="busca-linha">' +
            '<input id="integ-' + id + '-' + amb + '" type="password" autocomplete="off" spellcheck="false" placeholder="' + esc(cfg.placeholder[amb]) + '">' +
            '<button class="bt bt--principal" type="button" data-integ="' + id + '" data-acao="chave" data-amb="' + amb + '">Salvar e testar</button>' +
            (s.configurada
              ? '<button class="bt bt--linha" type="button" data-integ="' + id + '" data-acao="testar" data-amb="' + amb + '">Testar</button>' +
                '<button class="bt bt--perigo" type="button" data-integ="' + id + '" data-acao="remover" data-amb="' + amb + '">Remover</button>'
              : '') +
          '</div>' +
          '<span class="dica">' + esc(cfg.onde[amb]) + '</span>' +
        '</div>' +
        (id === 'asaas' ? linhaWebhook(d, amb) : '') +
      '</div>';
    }).join('');

    return '<div class="integ__cab">' +
        '<div><h3>' + cfg.nome + ' <span class="selo ' + (prod ? 'selo--alerta' : 'selo--aviso') + '">' +
          (prod ? 'produção' : 'teste') + '</span></h3><p>' + cfg.descricao + '</p></div>' +
        '<div class="modo" role="group" aria-label="Modo do ' + cfg.nome + '">' +
          AMBIENTES.map(function (amb) {
            return '<button type="button" data-integ="' + id + '" data-acao="ambiente" data-amb="' + amb + '" data-ambiente="' + amb + '"' +
              ' aria-pressed="' + (d.ambiente === amb) + '">' + ROTULO_AMB[amb] + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      (id === 'asaas'
        ? '<div class="campo" style="margin-bottom:var(--sp-3)"><label>Endereço do webhook</label>' +
            '<div class="integ-url">' + esc(integ.webhookUrl) + '</div>' +
            '<span class="dica">' + (integ.webhookLocal
              ? 'Você está no painel local: o Asaas não alcança este computador. Configure o webhook pelo painel do site publicado.'
              : '"Configurar automaticamente" cadastra este endereço na sua conta do Asaas, com um token secreto gerado aqui.') +
            '</span></div>'
        : '') +
      ambientes +
      '<p class="integ-msg" data-msg aria-live="polite"></p>';
  }

  function renderIntegracoes() {
    $('#integ-sem-kv').hidden = integ.armazenamento;
    $('#integ-asaas').innerHTML = cartaoIntegracao('asaas');
    $('#integ-melhorenvio').innerHTML = cartaoIntegracao('melhorenvio');
    $('#integ-email').innerHTML = cartaoEmail();
    if (!$('#integ-olist').innerHTML) $('#integ-olist').innerHTML = cartaoOlist();
  }

  /* ---- Olist: o token que o site usa e as permissões dele ---- */

  function cartaoOlist() {
    return '<div class="integ__cab"><div><h3>Olist <span class="selo selo--teal">ERP</span></h3>' +
        '<p>Catálogo e pedidos. O pedido pago vai para o Olist; para isso o aplicativo precisa das permissões de Produtos, Contatos e Pedidos.</p></div>' +
        '<button class="bt bt--linha" type="button" data-olist="verificar">Verificar permissões</button></div>' +
      '<div class="integ-amb">' +
        '<div class="campo"><label for="olist-token">Refresh token novo</label>' +
          '<div class="busca-linha"><input id="olist-token" type="password" autocomplete="off" spellcheck="false" placeholder="eyJhbGciOi…">' +
          '<button class="bt bt--principal" type="button" data-olist="token">Salvar e conectar</button></div>' +
          '<span class="dica">Depois de liberar permissões no aplicativo do Olist: rode <code>npm run get-token</code>, entre e autorize. ' +
          'Copie o <code>TINY_REFRESH_TOKEN</code> do .env e cole aqui em até 1 dia. O token só vale uma vez.</span></div>' +
      '</div>' +
      '<p class="integ-msg" data-msg aria-live="polite"></p>';
  }

  $('#integ-olist').addEventListener('click', function (e) {
    var bt = e.target.closest('[data-olist]');
    if (!bt || bt.disabled) return;
    var acao = bt.dataset.olist;
    var valor = {};
    if (acao === 'token') {
      valor.token = $('#olist-token').value.trim();
      if (!valor.token) { mensagem('olist', 'Cole o refresh token.', true); return; }
    }
    var original = bt.textContent;
    bt.disabled = true;
    bt.textContent = 'Aguarde…';
    mensagem('olist', '');
    API.integracao('olist', acao, null, valor)
      .then(function (r) {
        bt.disabled = false;
        bt.textContent = original;
        if (acao === 'token') $('#olist-token').value = '';
        mensagem('olist', r.mensagem, /sem permissão/.test(r.mensagem));
        aviso(r.mensagem);
      })
      .catch(function (err) {
        bt.disabled = false;
        bt.textContent = original;
        mensagem('olist', err.message, true);
      });
  });

  /* ---- e-mail (Resend): uma chave, um remetente, sem ambientes ---- */

  function cartaoEmail() {
    var d = integ.email || {};
    var situacao = d.configurada
      ? '<span class="selo selo--ok">cadastrada</span><span class="final">' + esc(d.final) + '</span>' + (d.em ? '<span class="final">em ' + data(d.em) + '</span>' : '')
      : (d.origemChave === 'ambiente' ? '<span class="selo selo--neutro">usando a variável do servidor</span>' : '<span class="selo selo--aviso">não configurado</span>');
    return '<div class="integ__cab"><div><h3>E-mail <span class="selo selo--teal">Resend</span></h3>' +
        '<p>Código de acesso do "Minha conta" e avisos de pedido recebido, pagamento confirmado e envio.</p></div></div>' +
      '<div class="integ-amb">' +
        '<div class="integ-amb__topo"><b>Chave da API</b>' + situacao + '</div>' +
        '<div class="campo"><label for="email-remetente">Remetente</label>' +
          '<input id="email-remetente" maxlength="120" placeholder="VM Click &lt;pedidos@vmclick.com.br&gt;" value="' + esc(d.remetente || '') + '">' +
          '<span class="dica">Precisa ser de um domínio verificado no Resend (Domains). Antes disso, os e-mails só chegam ao dono da conta Resend.</span></div>' +
        '<div class="campo"><label for="email-chave">Chave' + (d.configurada ? ' (substituir)' : '') + '</label>' +
          '<div class="busca-linha"><input id="email-chave" type="password" autocomplete="off" spellcheck="false" placeholder="re_…">' +
          '<button class="bt bt--principal" type="button" data-email="salvar">Salvar e testar</button>' +
          (d.configurada ? '<button class="bt bt--perigo" type="button" data-email="remover">Remover</button>' : '') + '</div>' +
          '<span class="dica">Em resend.com: API Keys > Create API Key (permissão "Sending access"). Grátis até 3.000 e-mails por mês.</span></div>' +
      '</div>' +
      '<div class="integ-amb">' +
        '<div class="campo"><label for="email-teste">Enviar e-mail de teste para</label>' +
          '<div class="busca-linha"><input id="email-teste" type="email" placeholder="voce@email.com">' +
          '<button class="bt bt--linha" type="button" data-email="teste"' + (d.configurada || d.origemChave ? '' : ' disabled') + '>Enviar teste</button></div></div>' +
      '</div>' +
      '<p class="integ-msg" data-msg aria-live="polite"></p>';
  }

  $('#integ-email').addEventListener('click', function (e) {
    var bt = e.target.closest('[data-email]');
    if (!bt || bt.disabled || !integ) return;
    var acao = bt.dataset.email;
    var valor = {};
    if (acao === 'salvar') {
      valor.remetente = $('#email-remetente').value.trim();
      var chave = $('#email-chave').value.trim();
      if (chave) valor.chave = chave;
    }
    if (acao === 'teste') valor.para = $('#email-teste').value.trim();
    if (acao === 'remover' && !confirm('Remover a chave do Resend? O site para de mandar e-mails.')) return;

    var original = bt.textContent;
    bt.disabled = true;
    bt.textContent = 'Aguarde…';
    mensagem('email', '');
    API.integracao('email', acao, null, valor)
      .then(function (r) {
        var url = integ.webhookUrl, local = integ.webhookLocal;
        integ = r.situacao; integ.webhookUrl = url; integ.webhookLocal = local;
        renderIntegracoes();
        mensagem('email', r.mensagem, /ATENÇÃO|ainda não/.test(r.mensagem));
        aviso(r.mensagem);
      })
      .catch(function (err) {
        bt.disabled = false;
        bt.textContent = original;
        mensagem('email', err.message, true);
      });
  });


  function carregarIntegracoes() {
    API.integracoes()
      .then(function (r) { integ = r; renderIntegracoes(); })
      .catch(function (err) {
        $('#integ-asaas').innerHTML = '<div class="aviso aviso--erro">' + esc(err.message) + '</div>';
      });
  }

  function mensagem(id, texto, erro) {
    var alvo = $('#integ-' + id + ' [data-msg]');
    if (!alvo) return;
    alvo.className = 'integ-msg ' + (erro ? 'integ-msg--erro' : 'integ-msg--ok');
    alvo.textContent = texto;
  }

  var CONFIRMAR_PRODUCAO = {
    asaas: 'Ativar o Asaas em PRODUÇÃO?\n\nA partir de agora as compras no site cobram de verdade.',
    melhorenvio: 'Ativar o Melhor Envio em PRODUÇÃO?\n\nA cotação passa a usar a conta real.',
  };

  $('#tela-integracoes').addEventListener('click', function (e) {
    var bt = e.target.closest('[data-acao]');
    if (!bt || bt.disabled || !integ) return;

    var id = bt.dataset.integ;
    var acao = bt.dataset.acao;
    var amb = bt.dataset.amb;
    var valor;

    if (acao === 'ambiente') {
      if (INTEG[id].dados().ambiente === amb) return;
      if (amb === 'producao' && !confirm(CONFIRMAR_PRODUCAO[id])) return;
    }
    if (acao === 'chave') {
      valor = $('#integ-' + id + '-' + amb).value.trim();
      if (!valor) { mensagem(id, 'Cole a ' + INTEG[id].rotulo.toLowerCase() + ' antes de salvar.', true); return; }
    }
    if (acao === 'remover' && !confirm('Remover a ' + INTEG[id].rotulo.toLowerCase() + ' de ' + ROTULO_AMB[amb] + '?')) return;

    var original = bt.textContent;
    bt.disabled = true;
    bt.textContent = acao === 'chave' || acao === 'testar' ? 'Testando…' : 'Aguarde…';
    mensagem(id, '');

    API.integracao(id, acao, amb, valor)
      .then(function (r) {
        var url = integ.webhookUrl;
        var local = integ.webhookLocal;
        integ = r.situacao;
        integ.webhookUrl = url;
        integ.webhookLocal = local;
        renderIntegracoes();
        mensagem(id, r.mensagem, false);
        aviso(r.mensagem);
      })
      .catch(function (err) {
        bt.disabled = false;
        bt.textContent = original;
        mensagem(id, err.message, true);
      });
  });

  /* ====================================================================== */
  /* 8. PUBLICAR                                                            */
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
  /* 9. BOOT                                                                */
  /* ====================================================================== */

  $('#sair').addEventListener('click', function () {
    API.sair().finally(function () { location.replace('/admin/'); });
  });

  API.sessao().then(function (s) {
    if (!s) { location.replace('/admin/'); return; }
    $('#quem').textContent = s.usuario;
    carregarPedidos();
    renderProdutos();
    renderBanners();
    renderBlog();
  });
})();
