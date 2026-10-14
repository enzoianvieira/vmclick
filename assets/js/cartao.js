/* ==========================================================================
   VM Click - cartão de crédito no checkout

   Formulário do cartão com uma prévia animada do cartão: número, nome e
   validade aparecem enquanto o cliente digita, a bandeira é reconhecida
   pelos primeiros dígitos e o cartão vira para o verso ao digitar o CVV.

   Os dados ficam só nos campos da página até o envio para /api/pedido.
   Nada vai para localStorage, sessionStorage ou estado do checkout.

   Uso:
     el.innerHTML = VMCartao.html();
     VMCartao.ligar(el);
     var erro = VMCartao.validar();   // null ou { campo, msg }
     var cartao = VMCartao.dados();   // { nome, numero, mes, ano, cvv }
   ========================================================================== */
(function () {
  'use strict';

  var Cartao = window.VMCartao = {};

  /* Elo e Hipercard antes de Visa e Mastercard: vários BINs Elo começam com
     4 ou 5 e seriam lidos como Visa/Master. */
  var BANDEIRAS = [
    { id: 'elo',        nome: 'Elo',        re: /^(4011(78|79)|43(1274|8935)|45(1416|7393|763[12])|50(4175|6699|67[0-7]\d|9\d{3})|627780|63(6297|6368)|650\d{3}|6516\d{2}|6550\d{2})/ },
    { id: 'hipercard',  nome: 'Hipercard',  re: /^(606282|3841)/ },
    { id: 'amex',       nome: 'American Express', re: /^3[47]/, cvv: 4, grupos: [4, 6, 5] },
    { id: 'diners',     nome: 'Diners',     re: /^3(0[0-5]|[68])/, grupos: [4, 6, 4] },
    { id: 'visa',       nome: 'Visa',       re: /^4/ },
    { id: 'mastercard', nome: 'Mastercard', re: /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/ },
  ];

  function digitos(v) { return String(v || '').replace(/\D/g, ''); }

  function bandeira(numero) {
    var d = digitos(numero);
    for (var i = 0; i < BANDEIRAS.length; i++) if (BANDEIRAS[i].re.test(d)) return BANDEIRAS[i];
    return null;
  }

  function grupos(b) { return (b && b.grupos) || [4, 4, 4, 4]; }
  function tamanhoCvv(b) { return (b && b.cvv) || 3; }

  /** "4111111111111111" -> "4111 1111 1111 1111", respeitando a bandeira. */
  function agrupar(d, b) {
    var partes = [], pos = 0, g = grupos(b);
    for (var i = 0; i < g.length && pos < d.length; i++) {
      partes.push(d.slice(pos, pos + g[i]));
      pos += g[i];
    }
    if (pos < d.length) partes.push(d.slice(pos));
    return partes.join(' ');
  }

  /* Na prévia, o que falta digitar aparece como "•". */
  function numeroNaPrevia(d, b) {
    var g = grupos(b), total = g.reduce(function (a, n) { return a + n; }, 0);
    var cheio = (d + new Array(total + 1).join('•')).slice(0, Math.max(total, d.length));
    return agrupar(cheio, b);
  }

  function luhn(d) {
    var soma = 0;
    for (var i = 0; i < d.length; i++) {
      var n = Number(d[d.length - 1 - i]);
      if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
      soma += n;
    }
    return d.length > 0 && soma % 10 === 0;
  }

  /* ----------------------------------------------------------------- tela */

  Cartao.html = function () {
    return '' +
    '<div class="cc-area">' +
      '<div class="cc" id="cc-previa" aria-hidden="true">' +
        '<div class="cc__giro">' +
          '<div class="cc__face cc__frente">' +
            '<div class="cc__brilho"></div>' +
            '<div class="cc__topo"><span class="cc__chip"></span><span class="cc__bandeira" data-cc="bandeira"></span></div>' +
            '<div class="cc__numero" data-cc="numero">•••• •••• •••• ••••</div>' +
            '<div class="cc__base">' +
              '<div class="cc__campo"><small>Nome do titular</small><span data-cc="nome">SEU NOME AQUI</span></div>' +
              '<div class="cc__campo cc__campo--val"><small>Validade</small><span data-cc="validade">MM/AA</span></div>' +
            '</div>' +
          '</div>' +
          '<div class="cc__face cc__verso">' +
            '<div class="cc__tarja"></div>' +
            '<div class="cc__assinatura"><span data-cc="cvv">•••</span></div>' +
            '<small class="cc__legenda">Código de segurança</small>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="field-grid field-grid--2 cc-campos">' +
        '<div class="field cc-campos__largo"><label for="cc-numero">Número do cartão <span class="req">*</span></label>' +
          '<input id="cc-numero" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000" maxlength="23">' +
          '<span class="err">Número do cartão inválido.</span></div>' +
        '<div class="field cc-campos__largo"><label for="cc-nome">Nome impresso no cartão <span class="req">*</span></label>' +
          '<input id="cc-nome" autocomplete="cc-name" placeholder="Como está no cartão" maxlength="60" style="text-transform:uppercase">' +
          '<span class="err">Informe o nome impresso no cartão.</span></div>' +
        '<div class="field"><label for="cc-validade">Validade <span class="req">*</span></label>' +
          '<input id="cc-validade" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5">' +
          '<span class="err">Validade inválida ou vencida.</span></div>' +
        '<div class="field"><label for="cc-cvv">CVV <span class="req">*</span></label>' +
          '<input id="cc-cvv" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4">' +
          '<span class="err">Código inválido.</span></div>' +
      '</div>' +
    '</div>';
  };

  Cartao.ligar = function (raiz) {
    var previa = raiz.querySelector('#cc-previa');
    if (!previa) return;
    var alvo = function (k) { return previa.querySelector('[data-cc="' + k + '"]'); };
    var num = raiz.querySelector('#cc-numero');
    var nome = raiz.querySelector('#cc-nome');
    var val = raiz.querySelector('#cc-validade');
    var cvv = raiz.querySelector('#cc-cvv');

    function virar(verso) { previa.classList.toggle('is-verso', verso); }

    num.addEventListener('input', function () {
      var b = bandeira(num.value);
      var g = grupos(b);
      var max = g.reduce(function (a, n) { return a + n; }, 0);
      var d = digitos(num.value).slice(0, Math.max(max, 19));
      num.value = agrupar(d, b);
      alvo('numero').textContent = numeroNaPrevia(d, b);
      alvo('bandeira').textContent = b ? b.nome : '';
      previa.setAttribute('data-bandeira', b ? b.id : '');
      cvv.maxLength = tamanhoCvv(b);
    });

    nome.addEventListener('input', function () {
      alvo('nome').textContent = nome.value.trim().toUpperCase() || 'SEU NOME AQUI';
    });

    val.addEventListener('input', function () {
      var d = digitos(val.value).slice(0, 4);
      /* "1" vira "01/" só quando não pode ser mês de dois dígitos */
      if (d.length === 1 && Number(d) > 1) d = '0' + d;
      val.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
      alvo('validade').textContent = val.value || 'MM/AA';
    });

    cvv.addEventListener('input', function () {
      cvv.value = digitos(cvv.value).slice(0, tamanhoCvv(bandeira(num.value)));
      /* o CVV aparece como pontos: tela compartilhada, gravação de tela */
      alvo('cvv').textContent = cvv.value ? cvv.value.replace(/./g, '•') : '•••';
      /* digitar também vira: preenchimento automático nem sempre dá foco */
      if (cvv.value) virar(true);
    });

    cvv.addEventListener('focus', function () { virar(true); });
    cvv.addEventListener('blur', function () { virar(false); });
    [num, nome, val].forEach(function (c) {
      c.addEventListener('focus', function () { virar(false); });
    });
    previa.addEventListener('click', function () { virar(!previa.classList.contains('is-verso')); });
  };

  /* -------------------------------------------------------------- dados */

  function validade() {
    var d = digitos((document.getElementById('cc-validade') || {}).value);
    return { mes: Number(d.slice(0, 2)), ano: 2000 + Number(d.slice(2, 4)), ok: d.length === 4 };
  }

  /** null se está tudo certo; senão { campo, msg } do primeiro problema. */
  Cartao.validar = function () {
    var numero = digitos(document.getElementById('cc-numero').value);
    var nome = document.getElementById('cc-nome').value.trim();
    var cvv = digitos(document.getElementById('cc-cvv').value);
    var v = validade();
    var agora = new Date();
    var b = bandeira(numero);

    if (numero.length < 13 || numero.length > 19 || !luhn(numero)) return { campo: 'cc-numero', msg: 'Número do cartão inválido.' };
    if (nome.length < 3) return { campo: 'cc-nome', msg: 'Informe o nome impresso no cartão.' };
    if (!v.ok || v.mes < 1 || v.mes > 12 ||
        v.ano < agora.getFullYear() || (v.ano === agora.getFullYear() && v.mes < agora.getMonth() + 1)) {
      return { campo: 'cc-validade', msg: 'Validade inválida ou vencida.' };
    }
    if (cvv.length !== tamanhoCvv(b)) return { campo: 'cc-cvv', msg: 'Código de segurança inválido.' };
    return null;
  };

  Cartao.dados = function () {
    var v = validade();
    return {
      nome: document.getElementById('cc-nome').value.trim().toUpperCase(),
      numero: digitos(document.getElementById('cc-numero').value),
      mes: v.mes,
      ano: v.ano,
      cvv: digitos(document.getElementById('cc-cvv').value),
    };
  };

  /** Depois de uma recusa: o CVV sai da tela, o resto fica para corrigir. */
  Cartao.limparCvv = function () {
    var cvv = document.getElementById('cc-cvv');
    if (cvv) { cvv.value = ''; cvv.dispatchEvent(new Event('input')); }
  };

})();
