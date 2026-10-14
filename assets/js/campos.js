/* ==========================================================================
   VM Click - máscaras e validação dos campos do checkout

   Cada campo declara o tipo em data-campo="..." e ganha:
     - máscara ao digitar: só os caracteres aceitos, no tamanho certo
       (CPF/CNPJ, telefone, CEP, UF...);
     - aviso ao sair do campo, se o que foi digitado não vale;
     - o aviso some assim que o valor fica certo.
   Campo vazio não acusa erro ao sair: obrigatoriedade é conferida no
   "Continuar", que sabe o que cada passo exige.

   Uso:
     VMCampos.ligar(raiz)              // aplica em todos [data-campo]
     VMCampos.erro('doc', '123')       // '' se vale, senão a mensagem
     VMCampos.marcar(input, mensagem)  // pinta ou limpa o erro do campo
   ========================================================================== */
(function () {
  'use strict';

  var Campos = window.VMCampos = {};

  function digitos(v) { return String(v || '').replace(/\D/g, ''); }

  var UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

  /* letras (com acento), espaço, apóstrofo, ponto e hífen */
  var NAO_LETRA = /[^A-Za-zÀ-ÖØ-öø-ÿ' .-]/g;

  function cpfValido(d) {
    if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
    for (var t = 9; t < 11; t++) {
      var s = 0;
      for (var i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }

  function cnpjValido(d) {
    if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
    function dv(n) {
      var pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      var s = 0;
      for (var i = 0; i < n; i++) s += Number(d[i]) * pesos[i];
      var r = s % 11;
      return r < 2 ? 0 : 11 - r;
    }
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }

  /* ------------------------------------------------------------ máscaras */

  var MASCARA = {
    nome: function (v) { return v.replace(NAO_LETRA, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '').slice(0, 100); },
    doc: function (v) {
      var d = digitos(v).slice(0, 14);
      if (d.length <= 11) {
        return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
      }
      return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    },
    email: function (v) { return v.replace(/\s/g, '').toLowerCase().slice(0, 120); },
    tel: function (v) {
      var d = digitos(v).slice(0, 11);
      if (d.length <= 2) return d.length ? '(' + d : '';
      if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
      if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
      return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    },
    cep: function (v) {
      var d = digitos(v).slice(0, 8);
      return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
    },
    endereco: function (v) { return v.replace(/[<>{}\[\]\\|^~`]/g, '').replace(/\s{2,}/g, ' ').slice(0, 120); },
    numero: function (v) { return v.replace(/[^0-9A-Za-z\/ -]/g, '').toUpperCase().slice(0, 10); },
    compl: function (v) { return v.replace(/[<>{}\[\]\\|^~`]/g, '').slice(0, 60); },
    cidade: function (v) { return v.replace(NAO_LETRA, '').replace(/\s{2,}/g, ' ').slice(0, 80); },
    uf: function (v) { return v.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2); },
  };

  /* ---------------------------------------------------------- validação */

  var REGRA = {
    nome: function (v) {
      var partes = v.trim().split(/\s+/).filter(function (p) { return p.length >= 2; });
      return partes.length >= 2 ? '' : 'Informe nome e sobrenome.';
    },
    doc: function (v) {
      var d = digitos(v);
      if (d.length !== 11 && d.length !== 14) return 'CPF tem 11 dígitos e CNPJ tem 14.';
      if (d.length === 11 && !cpfValido(d)) return 'CPF inválido. Confira os números.';
      if (d.length === 14 && !cnpjValido(d)) return 'CNPJ inválido. Confira os números.';
      return '';
    },
    email: function (v) {
      return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) ? '' : 'E-mail inválido. Ex.: voce@email.com';
    },
    tel: function (v) {
      var d = digitos(v);
      if (d.length !== 10 && d.length !== 11) return 'Informe DDD + número.';
      if (Number(d.slice(0, 2)) < 11) return 'DDD inválido.';
      if (d.length === 11 && d[2] !== '9') return 'Celular com 11 dígitos começa com 9 depois do DDD.';
      return '';
    },
    cep: function (v) { return digitos(v).length === 8 ? '' : 'O CEP tem 8 dígitos.'; },
    endereco: function (v) { return v.trim().length >= 3 ? '' : 'Informe o endereço.'; },
    numero: function (v) { return v.trim() ? '' : 'Informe o número (ou S/N).'; },
    compl: function () { return ''; },
    cidade: function (v) { return v.trim().length >= 2 ? '' : 'Informe a cidade.'; },
    uf: function (v) { return UFS.indexOf(v.trim().toUpperCase()) !== -1 ? '' : 'UF inválida. Ex.: PR'; },
  };

  Campos.erro = function (tipo, valor) {
    var r = REGRA[tipo];
    return r ? r(String(valor || '')) : '';
  };

  Campos.marcar = function (input, mensagem) {
    var campo = input.closest('.field');
    if (!campo) return;
    var err = campo.querySelector('.err');
    if (mensagem && err) err.textContent = mensagem;
    campo.classList.toggle('is-invalid', Boolean(mensagem));
    input.setAttribute('aria-invalid', mensagem ? 'true' : 'false');
  };

  /* Liga um campo: máscara no input, validação no blur. `regra` opcional
     sobrepõe a do tipo (o cartão usa as suas, que dependem da bandeira). */
  Campos.campo = function (input, mascara, regra) {
    if (!input || input.getAttribute('data-campo-ligado')) return;
    input.setAttribute('data-campo-ligado', '1');

    input.addEventListener('input', function () {
      if (mascara) {
        var antes = input.value;
        var depois = mascara(antes);
        if (depois !== antes) {
          /* mantém o cursor no fim só quando ele já estava lá */
          var noFim = true;
          try { noFim = input.selectionStart === antes.length; } catch (e) { /* type=email não expõe o cursor */ }
          input.value = depois;
          if (noFim) { try { input.setSelectionRange(depois.length, depois.length); } catch (e) { /* idem */ } }
        }
      }
      /* errou antes? o aviso some assim que o valor fica certo */
      if (input.closest('.field') && input.closest('.field').classList.contains('is-invalid')) {
        if (regra && !regra(input.value)) Campos.marcar(input, '');
      }
    });

    input.addEventListener('blur', function () {
      if (!input.value.trim()) { Campos.marcar(input, ''); return; }
      Campos.marcar(input, regra ? regra(input.value) : '');
    });
  };

  Campos.ligar = function (raiz) {
    (raiz || document).querySelectorAll('[data-campo]').forEach(function (input) {
      var tipo = input.getAttribute('data-campo');
      Campos.campo(input, MASCARA[tipo], function (v) { return Campos.erro(tipo, v); });
    });
  };

  Campos.digitos = digitos;
})();
