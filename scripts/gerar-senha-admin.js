#!/usr/bin/env node
/**
 * VM Click - gera as variáveis de ambiente do login do painel
 *
 * A senha nunca é guardada. O que vai para a Vercel é o hash scrypt dela, e
 * mesmo quem tiver acesso ao painel de variáveis não consegue voltar à senha.
 *
 * Uso:
 *   node scripts/gerar-senha-admin.js "usuario" "senha-forte-aqui"
 */

const crypto = require('crypto');
const { gerarHash } = require('../api/_sessao.js');

const [, , usuario, senha] = process.argv;

if (!usuario || !senha) {
  console.error('\nUso: node scripts/gerar-senha-admin.js "usuario" "senha"\n');
  process.exit(1);
}

const MODO_DEV = process.argv.includes('--dev');

if (senha.length < 12 && !MODO_DEV) {
  console.error('');
  console.error('Senha muito curta. Use pelo menos 12 caracteres.');
  console.error('Para senha curta apenas no ambiente local, rode com --dev.');
  console.error('');
  process.exit(1);
}

const hash = gerarHash(senha);
const segredo = crypto.randomBytes(48).toString('base64url');

console.log('');
console.log('Cadastre estas três variáveis no painel da Vercel');
console.log('(Settings > Environment Variables). Nunca as coloque no repositório.');
console.log('='.repeat(72));
console.log('');
console.log(`ADMIN_USUARIO=${usuario}`);
console.log(`ADMIN_SENHA_HASH=${hash}`);
console.log(`SESSAO_SEGREDO=${segredo}`);
console.log('');
if (MODO_DEV || senha.length < 12) {
  console.log('ATENÇÃO: senha fraca. Use somente na sua máquina.');
  console.log('Quem entra no painel enxerga catálogo e preços de custo do Olist.');
  console.log('Antes de publicar, gere outra sem --dev e troque na Vercel.');
  console.log('');
}
console.log('A senha em si não é gravada em lugar nenhum. Guarde-a no gerenciador');
console.log('de senhas de quem vai usar o painel.');
console.log('');
