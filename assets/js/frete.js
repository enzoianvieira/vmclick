/* ==========================================================================
   VM Click - cotação de frete (cliente)

   Fala só com /api/frete/cotar. Peso, medidas e preço ficam no servidor: aqui
   vai apenas o CEP e a lista de SKU + quantidade.

   Uso:
     VMFrete.cotar('80000-000').then(...)     // consulta e guarda em cache
     VMFrete.selecionada()                    // opção escolhida, ou null
     VMFrete.montarSeletor(el, dados, { aoEscolher })  // pinta as opções
   ========================================================================== */
(function () {
  'use strict';

  var Frete = window.VMFrete = {};

  var CHAVE = 'vm_frete_v1';
  var ENDPOINT = '/api/frete/cotar';

  /* Cache por CEP + composição do carrinho. Trocar a quantidade de um item
     muda o pacote, então a chave precisa incluir o carrinho, não só o CEP. */
  var cache = {};

  function assinaturaCarrinho() {
    return (window.VMCart ? VMCart.itens : [])
      .map(function (i) { return i.slug + ':' + i.qtd; })
      .sort()
      .join('|');
  }

  function skusDoCarrinho() {
    return (window.VMCart ? VMCart.linhas() : []).map(function (l) {
      return { sku: l.p.sku, qtd: l.qtd };
    });
  }

  /* ------------------------------------------------------------- escolhida */

  function lerEscolha() {
    try { return JSON.parse(sessionStorage.getItem(CHAVE)) || null; }
    catch (e) { return null; }
  }

  Frete.selecionada = function () {
    var e = lerEscolha();
    /* A escolha morre se o carrinho mudou depois dela: o preço cotado valia
       para aquele pacote, não para este. */
    if (!e || e.assinatura !== assinaturaCarrinho()) return null;
    return e.opcao;
  };

  Frete.escolher = function (opcao) {
    if (!opcao) { sessionStorage.removeItem(CHAVE); }
    else {
      try {
        sessionStorage.setItem(CHAVE, JSON.stringify({
          opcao: opcao, cep: Frete.cep(), assinatura: assinaturaCarrinho(),
        }));
      } catch (e) { /* sessão cheia ou bloqueada: segue sem lembrar */ }
    }
    document.dispatchEvent(new CustomEvent('vm:frete'));
  };

  Frete.cep = function (novo) {
    if (novo === undefined) {
      try { return sessionStorage.getItem('vm_cep') || ''; } catch (e) { return ''; }
    }
    try { sessionStorage.setItem('vm_cep', novo); } catch (e) { /* segue */ }
    return novo;
  };

  Frete.limpar = function () { Frete.escolher(null); };

  /* --------------------------------------------------------------- cotação */

  Frete.formatarCep = function (v) {
    var d = String(v || '').replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  };

  /**
   * Cota uma lista de itens qualquer. A página do produto usa para cotar só
   * aquele item, antes de existir carrinho.
   */
  Frete.cotarItens = function (cep, itens, subtotal) {
    var digitos = String(cep || '').replace(/\D/g, '');
    if (digitos.length !== 8) return Promise.reject(new Error('CEP incompleto.'));
    if (!itens || !itens.length) return Promise.reject(new Error('Nada para cotar.'));

    var chave = digitos + '#' + itens.map(function (i) { return i.sku + ':' + i.qtd; }).sort().join('|');
    if (cache[chave]) return Promise.resolve(cache[chave]);

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cep: digitos, itens: itens, subtotal: subtotal || 0 }),
    }).then(function (r) {
      /* Resposta pode não ser JSON: função fora do ar, 404 de deploy, página
         de erro do proxy. Sem isto o visitante lê "Unexpected end of JSON
         input", que não diz nada a ele. */
      return r.text().then(function (texto) {
        var j = {};
        try { j = JSON.parse(texto); } catch (e) { j = {}; }
        if (!r.ok) throw new Error(j.erro || 'Serviço de frete indisponível no momento.');
        if (!j.opcoes) throw new Error('Serviço de frete indisponível no momento.');
        return j;
      });
    }).then(function (j) {
      cache[chave] = j;
      Frete.cep(Frete.formatarCep(digitos));
      return j;
    });
  };

  /** Cota o carrinho inteiro. É o que o checkout usa. */
  Frete.cotar = function (cep) {
    var itens = skusDoCarrinho();
    if (!itens.length) return Promise.reject(new Error('Carrinho vazio.'));
    return Frete.cotarItens(cep, itens, window.VMCart ? VMCart.subtotal() : 0);
  };

  /* ---------------------------------------------------------------- seletor */

  var MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
  var DIAS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

  /** Hoje + N dias úteis (sem feriados): "qui., 15 de out." */
  Frete.dataUtil = function (dias) {
    var d = new Date();
    var n = Math.max(0, Number(dias) || 0);
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) n--;
    }
    return DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* "Entrega VM Click - Curitiba e região" -> nome + complemento */
  function partes(o) {
    if (o.tipo === 'transportadora') return { nome: o.servico, extra: o.transportadora };
    var p = String(o.servico || '').split(' - ');
    return { nome: p[0], extra: p.slice(1).join(' - ') };
  }

  function diasUteis(n) {
    return n === 1 ? '1 dia útil' : n + ' dias úteis';
  }

  /* As linhas de cada opção: quando chega, o detalhe e, na entrega própria,
     quanto falta para o frete grátis. */
  function descrever(o, ctx) {
    if (o.tipo === 'retirada') {
      return {
        chega: 'Pronto em 2 horas',
        det: 'R. Amadeu do Amaral, 1602' + (window.VM && VM.EMPRESA ? ' · ' + VM.EMPRESA.horario : ''),
      };
    }
    if (o.tipo === 'combinar') {
      return { chega: 'Valor e prazo confirmados pela loja', det: 'A equipe entra em contato antes do envio' };
    }
    if (o.tipo === 'local') {
      return {
        chega: 'Chega até ' + Frete.dataUtil(o.prazo || 3),
        det: 'Entregue pela própria loja em até ' + diasUteis(o.prazo || 3),
      };
    }
    return {
      chega: o.prazo ? 'Chega até ' + Frete.dataUtil(o.prazo) : 'Prazo informado após a postagem',
      det: o.prazo ? diasUteis(o.prazo) + ' após a postagem' : '',
    };
  }

  /* Curitiba abaixo do piso: quanto falta para a entrega grátis da loja. */
  function barraGratis(g) {
    var pct = Math.max(4, Math.min(100, Math.round((g.acima - g.falta) / g.acima * 100)));
    return '<div class="frete-barra">' +
      '<span class="frete-barra__trilho"><span style="width:' + pct + '%"></span></span>' +
      '<span class="frete-op__det">Faltam <b>' + window.VM.money(g.falta) + '</b> para entrega grátis em Curitiba ' +
        '(pedidos a partir de ' + window.VM.money(g.acima) + ')</span>' +
    '</div>';
  }

  /* Entrega em até 24h não é cotada no site: abre o WhatsApp com CEP,
     endereço e itens já escritos, e a loja responde com o valor. */
  function hrefWhats(mensagem) {
    var tel = (String(window.VM.EMPRESA.whatsapp).match(/phone=(\d+)/) || [])[1] || '';
    return 'https://api.whatsapp.com/send?phone=' + tel + '&text=' + encodeURIComponent(mensagem || '');
  }

  function linkEntregaRapida(mensagem) {
    return '<a class="frete-op frete-op--link" target="_blank" rel="noopener" href="' + esc(hrefWhats(mensagem)) + '">' +
      '<span class="frete-op__icone">' + window.VM.icon('relogio') + '</span>' +
      '<span class="frete-op__corpo">' +
        '<span class="frete-op__topo"><b class="frete-op__nome">Precisa em até 24 horas?</b></span>' +
        '<span class="frete-op__det">Mande o endereço pelo WhatsApp e a loja cota a entrega na hora.</span>' +
      '</span>' +
      '<span class="frete-op__acao">Cotar no WhatsApp</span>' +
    '</a>';
  }

  function linhaOpcao(o, escolhida, ctx, selos) {
    var sel = escolhida && escolhida.id === o.id;
    var p = partes(o);
    var d = descrever(o, ctx);
    var preco = o.tipo === 'combinar' ? 'A combinar' : (o.preco > 0 ? window.VM.money(o.preco) : 'Grátis');

    return '<label class="frete-op' + (sel ? ' is-sel' : '') + '">' +
      '<input type="radio" name="frete-opcao" value="' + esc(o.id) + '"' + (sel ? ' checked' : '') + '>' +
      '<span class="frete-op__corpo">' +
        '<span class="frete-op__topo">' +
          '<b class="frete-op__nome">' + esc(p.nome) + '</b>' +
          (p.extra ? '<span class="frete-op__extra">' + esc(p.extra) + '</span>' : '') +
          (selos.barato === o.id ? '<span class="frete-selo frete-selo--barato">Mais barato</span>' : '') +
          (selos.rapido === o.id ? '<span class="frete-selo">Mais rápido</span>' : '') +
        '</span>' +
        '<span class="frete-op__chega">' + esc(d.chega) + '</span>' +
        (d.det ? '<span class="frete-op__det">' + esc(d.det) + '</span>' : '') +
      '</span>' +
      '<b class="frete-op__preco' + (o.preco > 0 || o.tipo === 'combinar' ? '' : ' is-gratis') + '">' + preco + '</b>' +
    '</label>';
  }

  function aviso(titulo, texto) {
    return '<div class="frete-aviso">' +
      '<b>' + titulo + '</b><p>' + texto + '</p>' +
      '<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="' + window.VM.EMPRESA.whatsapp + '">Pedir orçamento de frete no WhatsApp</a>' +
    '</div>';
  }

  /** Esqueleto enquanto a cotação não volta. */
  Frete.carregando = function (el) {
    var linha = '<div class="frete-op frete-op--esqueleto" aria-hidden="true"><span class="sk sk--radio"></span>' +
      '<span class="frete-op__corpo"><span class="sk" style="width:55%"></span><span class="sk sk--fino" style="width:35%"></span></span>' +
      '<span class="sk" style="width:64px"></span></div>';
    el.innerHTML = '<p class="frete-nota" role="status">Buscando prazos e preços…</p>' +
      '<div class="frete-lista">' + linha + linha + linha + '</div>';
  };

  /**
   * Pinta as opções dentro de `el`, separadas entre receber em casa e
   * retirar na loja. `opcoes`: { aoEscolher, mensagemEntregaRapida }.
   */
  Frete.montarSeletor = function (el, dados, opcoes) {
    opcoes = opcoes || {};
    var ctx = {};
    var rapida = dados.entregaRapida
      ? linkEntregaRapida(typeof opcoes.mensagemEntregaRapida === 'function' ? opcoes.mensagemEntregaRapida() : '')
      : '';

    /* Excedeu o limite da transportadora ou nenhuma atende: retirada e
       entrega própria continuam valendo - o aviso entra junto das opções
       que sobraram, não no lugar delas. */
    var topo = '';
    if (dados.semTransportadora) {
      topo = aviso('Ainda não entregamos neste CEP pelo site',
        'Nenhuma transportadora atende agora. A equipe cota o envio para você pelo WhatsApp, normalmente no mesmo dia.');
    } else if (dados.excedeLimite) {
      topo = aviso('Este pedido passa do limite das transportadoras',
        'Volume ou peso acima do que a encomenda comum aceita. A equipe cota uma entrega sob medida pelo WhatsApp.');
    }

    if (!dados.opcoes.length) {
      el.innerHTML = (topo || '<div class="frete-aviso"><b>Nenhuma forma de entrega para este CEP.</b><p>Confira o CEP ou fale com a loja.</p></div>') + rapida;
      Frete.escolher(null);
      return;
    }

    /* Sem escolha anterior válida, marca a entrega mais barata. A retirada na
       loja fica de fora da escolha automática mesmo custando zero: quem digita
       um CEP de outro estado não quer sair daqui com "retirar em Curitiba"
       marcado sem ter percebido. Ela só entra se for a única opção. */
    var entregas = dados.opcoes.filter(function (o) { return o.tipo !== 'retirada'; });
    var retiradas = dados.opcoes.filter(function (o) { return o.tipo === 'retirada'; });

    var atual = Frete.selecionada();
    if (!atual || !dados.opcoes.some(function (o) { return o.id === atual.id; })) {
      var candidatas = entregas.length ? entregas : dados.opcoes;
      atual = candidatas.reduce(function (a, b) { return b.preco < a.preco ? b : a; });
      Frete.escolher(atual);
    }

    /* Selos só fazem sentido com mais de uma entrega para comparar. */
    var selos = {};
    if (entregas.length > 1) {
      selos.barato = entregas.reduce(function (a, b) { return b.preco < a.preco ? b : a; }).id;
      var comPrazo = entregas.filter(function (o) { return o.prazo; });
      if (comPrazo.length > 1) selos.rapido = comPrazo.reduce(function (a, b) { return b.prazo < a.prazo ? b : a; }).id;
    }
    entregas.sort(function (a, b) { return a.preco - b.preco; });

    el.innerHTML =
      topo +
      (entregas.length || rapida
        ? '<h4 class="frete-grupo">Receber em casa</h4>' +
          (dados.freteGratis && dados.freteGratis.falta > 0 ? barraGratis(dados.freteGratis) : '') +
          '<div class="frete-lista">' +
          entregas.map(function (o) { return linhaOpcao(o, atual, ctx, selos); }).join('') + rapida + '</div>'
        : '') +
      (retiradas.length
        ? '<h4 class="frete-grupo">' + (entregas.length ? 'Ou retire na loja' : 'Retire na loja') + '</h4><div class="frete-lista">' +
          retiradas.map(function (o) { return linhaOpcao(o, atual, ctx, selos); }).join('') + '</div>'
        : '') +
      (dados.pesoEstimado
        ? '<div class="frete-info">' + window.VM.icon('info') +
          '<p>Alguns itens estão com medida estimada. O frete é conferido pela loja antes do envio.</p></div>'
        : '');

    var link = el.querySelector('.frete-op--link');
    if (link && typeof opcoes.mensagemEntregaRapida === 'function') {
      link.addEventListener('click', function () { link.href = hrefWhats(opcoes.mensagemEntregaRapida()); });
    }

    el.querySelectorAll('input[name="frete-opcao"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var escolhida = dados.opcoes.filter(function (o) { return o.id === r.value; })[0];
        el.querySelectorAll('.frete-op').forEach(function (l) {
          l.classList.toggle('is-sel', l.contains(r) && r.checked);
        });
        Frete.escolher(escolhida);
        if (opcoes.aoEscolher) opcoes.aoEscolher(escolhida);
      });
    });
  };
})();
