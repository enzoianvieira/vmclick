/**
 * VM Click - armazém de pedidos, lado servidor
 *
 * Os pedidos precisam de um lugar gravável entre a criação da cobrança e o
 * aviso de pagamento do Asaas, que chega minutos ou dias depois, muitas vezes
 * numa instância diferente da função. Memória do processo não serve.
 *
 * Usa o mesmo Upstash Redis (KV) que já guarda os tokens do Olist e do Melhor
 * Envio, e também a configuração das integrações feita no painel. Sem KV, na
 * máquina de desenvolvimento, cai num arquivo local. Na
 * Vercel sem KV não há onde gravar: disponivel() responde false e o checkout
 * se recusa a cobrar, em vez de receber dinheiro de um pedido que se perde.
 */

const fs = require('fs');
const path = require('path');

const { credenciaisKV } = require('./_credenciais.js');

const ARQUIVO_LOCAL = path.join(__dirname, '..', '.dados-locais.json');

function podeGravarLocal() {
  return !process.env.VERCEL;
}

function disponivel() {
  return Boolean(credenciaisKV()) || podeGravarLocal();
}

/* --------------------------------------------------------------- KV ------ */

/* Comando no formato de lista, enviado no corpo para a raiz da API REST do
   Upstash. Aceita qualquer comando com opções (SET ... NX EX), coisa que o
   formato de caminho usado em _credenciais.js não expressa bem. */
async function kv(args) {
  const cred = credenciaisKV();
  const res = await fetch(cred.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cred.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.map(String)),
  });
  if (!res.ok) throw new Error(`KV respondeu ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`KV: ${j.error}`);
  return j.result;
}

/* ------------------------------------------------------ arquivo local ---- */

function lerLocal() {
  try { return JSON.parse(fs.readFileSync(ARQUIVO_LOCAL, 'utf8')); } catch (e) { return {}; }
}

function gravarLocal(dados) {
  fs.writeFileSync(ARQUIVO_LOCAL, JSON.stringify(dados, null, 2));
}

function vivoLocal(registro) {
  return registro && (!registro.exp || registro.exp > Date.now());
}

/* ----------------------------------------------------------- operações --- */

async function ler(chave) {
  if (credenciaisKV()) {
    const r = await kv(['GET', chave]);
    return r == null ? null : JSON.parse(r);
  }
  const reg = lerLocal()[chave];
  return vivoLocal(reg) ? reg.v : null;
}

/** Grava `valor` como JSON. `segundos` opcional: some sozinho depois disso. */
async function gravar(chave, valor, segundos) {
  if (credenciaisKV()) {
    const args = ['SET', chave, JSON.stringify(valor)];
    if (segundos) args.push('EX', segundos);
    await kv(args);
    return;
  }
  const dados = lerLocal();
  dados[chave] = { v: valor, exp: segundos ? Date.now() + segundos * 1000 : 0 };
  gravarLocal(dados);
}

/** Grava só se a chave ainda não existe. Devolve true se gravou. */
async function gravarSeNovo(chave, valor, segundos) {
  if (credenciaisKV()) {
    const args = ['SET', chave, JSON.stringify(valor), 'NX'];
    if (segundos) args.push('EX', segundos);
    return (await kv(args)) === 'OK';
  }
  const dados = lerLocal();
  if (vivoLocal(dados[chave])) return false;
  dados[chave] = { v: valor, exp: segundos ? Date.now() + segundos * 1000 : 0 };
  gravarLocal(dados);
  return true;
}

/** Soma 1 e devolve o novo valor. `segundos` vale a partir do primeiro uso. */
async function incrementar(chave, segundos) {
  if (credenciaisKV()) {
    const n = Number(await kv(['INCR', chave]));
    if (n === 1 && segundos) await kv(['EXPIRE', chave, segundos]);
    return n;
  }
  const dados = lerLocal();
  const reg = vivoLocal(dados[chave]) ? dados[chave] : { v: 0, exp: segundos ? Date.now() + segundos * 1000 : 0 };
  reg.v = Number(reg.v) + 1;
  dados[chave] = reg;
  gravarLocal(dados);
  return reg.v;
}

module.exports = { disponivel, ler, gravar, gravarSeNovo, incrementar };
