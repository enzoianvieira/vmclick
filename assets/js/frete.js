/* ==========================================================================
   VM Click - cotação de frete (cliente)

   Fala só com /api/frete/cotar. Peso, medidas e preço ficam no servidor: aqui
   vai apenas o CEP e a lista de SKU + quantidade.

   Uso:
     VMFrete.cotar('80000-000').then(...)     // consulta e guarda em cache
     VMFrete.selecionada()                    // opção escolhida, ou null
     VMFrete.montarSeletor(el, { aoEscolher }) // pinta a lista de opções
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

  function linhaOpcao(o, escolhida) {
    var sel = escolhida && escolhida.id === o.id;
    var preco = o.preco > 0 ? window.VM.money(o.preco) : 'Grátis';

    return '<label class="pay-opt frete-opt' + (sel ? ' is-sel' : '') + '">' +
      '<input type="radio" name="frete-opcao" value="' + o.id + '"' + (sel ? ' checked' : '') + '>' +
      window.VM.icon(o.tipo === 'retirada' ? 'loja' : 'caminhao') +
      '<span>' +
        '<span class="pay-opt__t">' + o.servico +
          (o.tipo === 'transportadora' && o.transportadora ? ' · ' + o.transportadora : '') +
        '</span>' +
        '<span class="pay-opt__d">' + (o.detalhe || '') + '</span>' +
      '</span>' +
      '<b class="frete-opt__preco">' + preco + '</b>' +
    '</label>';
  }

  /**
   * Pinta a lista de opções dentro de `el` e devolve o controle do rádio.
   * `aoEscolher` recebe a opção sempre que o visitante trocar.
   */
  Frete.montarSeletor = function (el, dados, opcoes) {
    opcoes = opcoes || {};

    /* Excedeu o limite da transportadora, mas retirada na loja e entrega
       própria continuam valendo - o aviso entra junto das opções que sobraram,
       não no lugar delas. */
    var aviso = '';
    if (dados.semTransportadora) {
      aviso =
        '<div class="frete-aviso">' +
          '<b>Nenhuma transportadora atende este CEP.</b>' +
          '<p>A entrega para esta região precisa ser combinada caso a caso. ' +
          'Fale com a loja que a equipe cota para você.</p>' +
          '<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="' +
            window.VM.EMPRESA.whatsapp + '">Pedir orçamento de frete</a>' +
        '</div>';
    } else if (dados.excedeLimite) {
      aviso =
        '<div class="frete-aviso">' +
          '<b>Este carrinho passa do limite das transportadoras.</b>' +
          '<p>Volume ou peso acima do que a encomenda comum aceita. ' +
          'Fale com a loja para um orçamento de entrega sob medida.</p>' +
          '<a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="' +
            window.VM.EMPRESA.whatsapp + '">Pedir orçamento de frete</a>' +
        '</div>';
    }

    if (!dados.opcoes.length) {
      el.innerHTML = aviso ||
        '<div class="frete-aviso"><b>Nenhuma forma de entrega para este CEP.</b>' +
        '<p>Confira o CEP ou fale com a loja.</p></div>';
      Frete.escolher(null);
      return;
    }

    /* Sem escolha anterior válida, marca a entrega mais barata. A retirada na
       loja fica de fora da escolha automática mesmo custando zero: quem digita
       um CEP de outro estado não quer sair daqui com "retirar em Curitiba"
       marcado sem ter percebido. Ela só entra se for a única opção. */
    var atual = Frete.selecionada();
    if (!atual || !dados.opcoes.some(function (o) { return o.id === atual.id; })) {
      var entregas = dados.opcoes.filter(function (o) { return o.tipo !== 'retirada'; });
      var candidatas = entregas.length ? entregas : dados.opcoes;
      atual = candidatas.reduce(function (a, b) { return b.preco < a.preco ? b : a; });
      Frete.escolher(atual);
    }

    el.innerHTML =
      aviso +
      '<div class="stack">' + dados.opcoes.map(function (o) { return linhaOpcao(o, atual); }).join('') + '</div>' +
      (dados.pesoEstimado
        ? '<p class="frete-nota">Alguns itens estão sem peso cadastrado e entraram com medida estimada. ' +
          'O valor final é confirmado pela loja antes do envio.</p>'
        : '');

    el.querySelectorAll('input[name="frete-opcao"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var escolhida = dados.opcoes.filter(function (o) { return o.id === r.value; })[0];
        el.querySelectorAll('.frete-opt').forEach(function (l) {
          l.classList.toggle('is-sel', l.contains(r) && r.checked);
        });
        Frete.escolher(escolhida);
        if (opcoes.aoEscolher) opcoes.aoEscolher(escolhida);
      });
    });
  };
})();
