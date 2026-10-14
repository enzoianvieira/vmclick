# Pagamento — Asaas

Pix, boleto e cartão no checkout, com confirmação automática do pagamento.

## Por que Asaas

Decidido em setembro de 2026 (ver `VM-Click-frete-e-pagamento.txt`, parte 2):
conta digital PJ além de gateway, Pix e boleto a valor fixo (R$ 1,99) e
integração simples. O gateway fica isolado em `api/_asaas.js` — trocar por
Pagar.me depois é reescrever esse arquivo, não o checkout.

## Como está montado

```
finalizar.html
   │  POST /api/pedido  { cliente, entrega, itens: [{sku, qtd}], frete: "me-3",
   │                      forma, parcelas, totalVisto, cartao? }
   ▼
api/pedido.js ── recalcula preço (catálogo) e frete (cotação nova)
   │             grava o pedido no KV ─────────────── api/_pedido.js, _armazem.js
   │             cria cliente + cobrança no Asaas ─── api/_asaas.js
   ▼
pedido.html?id=…  ← Pix (QR + copia e cola), boleto (linha + PDF) ou cartão já pago
   │  GET /api/pedido?id=…  a cada 5 s até mudar de status
   ▼
Asaas ── POST /api/pagamento/webhook ──► pedido "pago"
```

**O navegador não define valor nenhum.** Do checkout vêm só SKU, quantidade, o
id da opção de entrega e a forma de pagamento. Preço, frete e desconto do Pix
são recalculados no servidor. `totalVisto` é só conferência: se o total
recalculado for outro, o pedido é recusado com o valor novo, para ninguém ser
cobrado de um valor que não viu.

**Tudo acontece dentro do site.** O cliente nunca é mandado para a fatura do
Asaas: Pix mostra o QR na página do pedido, boleto mostra a linha digitável, e
o cartão é digitado no checkout, com uma prévia animada do cartão
(`assets/js/cartao.js`). Se o QR do Pix não puder ser gerado, a cobrança é
cancelada e o checkout pede outra forma de pagamento.

**Cartão digitado no site — atenção ao PCI-DSS.** O Asaas não tem SDK para
tokenizar no navegador, então os dados do cartão passam pelo servidor da loja
a caminho do Asaas (`POST /payments` com `creditCard` e `remoteIp`). Isso põe a
loja no escopo do PCI-DSS, ao contrário do que a fatura hospedada faria.
Cuidados no código:
- o cartão só existe na memória da chamada: não vai para pedido, KV nem log;
- só HTTPS (Vercel);
- recusa devolve mensagem genérica, sem o motivo da operadora;
- 5 recusas por hora por IP bloqueiam novas tentativas de cartão, contra
  "teste de cartão" (fraudador validando cartões roubados no checkout);
- tempo esgotado na criação: confere pela referência antes de devolver erro,
  para não cobrar duas vezes.

Cartão aprovado volta pago na mesma chamada. Em produção, o Asaas pode exigir
que o cartão via API seja habilitado na conta.

**Teste no sandbox:** qualquer número válido (Luhn) com validade futura e CVV
de 3 dígitos é aprovado. Recusa: Mastercard `5184019740373151`, Visa
`4916561358240741`.

**Webhook autenticado.** O Asaas manda o token no cabeçalho
`asaas-access-token`; sem ele, 401. E mesmo com o token certo, "pago" só vale
depois de confirmado na API do Asaas. Eventos repetidos são descartados pelo id.

**Transições de status só para a frente.** `aguardando → pago | vencido |
cancelado`, `pago → estornado | contestado`. Um "vencido" atrasado não desfaz
um pedido pago.

**A página do pedido mostra só itens e valores** — nunca nome, CPF, e-mail ou
endereço. O id na URL tem 128 bits aleatórios e é o que dá acesso a ela.

## Configuração

Pelo painel administrativo, aba **Integrações** — sem mexer na Vercel:

1. Conta no sandbox: `https://sandbox.asaas.com`. Em Integrações > Chaves de
   API, gerar a chave (começa com `$aact_hmlg_`).
2. **No sandbox, cadastrar uma chave Pix** (aleatória serve). Sem ela o Asaas
   recusa cobrança Pix.
3. No painel, colar a chave em "Teste (sandbox)" e clicar **Salvar e testar**.
   A chave só é guardada se o Asaas aceitar.
4. Clicar **Configurar automaticamente** no webhook. O painel cadastra
   `https://<site>/api/pagamento/webhook` na conta do Asaas com um token
   secreto gerado na hora. Só funciona no painel do site publicado — o Asaas
   não alcança `localhost`.
5. Para valer: colar a chave de produção (`$aact_prod_`) em "Produção",
   configurar o webhook de produção e trocar o modo para **Produção**. O painel
   não deixa ativar um modo sem chave cadastrada nele, e recusa chave de teste
   no campo de produção (e vice-versa).

**KV obrigatório.** Chaves e pedidos ficam no mesmo Upstash do Olist e do
Melhor Envio. Sem KV na Vercel, o painel não tem onde guardar a chave e o
checkout recusa cobrar.

### Como as chaves ficam guardadas

- Cifradas (AES-256-GCM) com chave derivada de `SESSAO_SEGREDO`. Quem lê o KV
  sozinho não lê as chaves. **Trocar `SESSAO_SEGREDO` invalida as chaves
  guardadas** — é só cadastrá-las de novo no painel.
- Nunca voltam para o navegador: o painel mostra só o final (`…abcd`).
- Uma por ambiente. Trocar o modo não pede para digitar de novo.
- Uma troca feita no painel chega a todas as instâncias em até 30 s.
- Ao reconfigurar o webhook, o token anterior continua aceito, para os avisos
  que já estavam na fila do Asaas.

### Variáveis de ambiente (alternativa)

As variáveis da seção "Pagamento" do `.env.example` (`ASAAS_API_KEY`,
`ASAAS_AMBIENTE`, `ASAAS_WEBHOOK_TOKEN`) continuam valendo quando o painel não
tem chave para o ambiente em uso. O painel mostra "usando a variável do
servidor" nesse caso. As regras do checkout (`PAGAMENTO_FORMAS`,
`PIX_DESCONTO`, `CARTAO_MAX_PARCELAS`, `BOLETO_DIAS`) seguem só por variável.

Opcional: `SITE_URL=https://vmclick.vercel.app` fixa o endereço usado para
montar a URL do webhook no painel (por padrão vem do próprio acesso).

**Chave Pix obrigatória.** Sem chave Pix ativa na conta, o Asaas não gera QR
code e o Pix fica indisponível no checkout. O botão "Testar" do painel avisa.

## Testar na sua máquina

`npm run dev` roda site e funções juntos. Sem KV, pedidos e chaves vão para
`.dados-locais.json` (fora do git: tem CPF e endereço de quem testou).

O webhook não chega no `localhost`. Para isso a página do pedido também confere
a cobrança direto no Asaas a cada 20 s enquanto está aguardando — no sandbox dá
para marcar a cobrança como paga pelo painel e ver a página virar sozinha.

## Decisões embutidas

| Regra | Onde mudar |
|---|---|
| Desconto Pix 5% sobre produtos + frete | `PIX_DESCONTO` |
| Cartão até 6× sem juros, parcela mínima R$ 25 (a taxa do parcelado é da loja) | `CARTAO_MAX_PARCELAS`, `CARTAO_PARCELA_MINIMA` |
| Boleto vence em 3 dias; Pix em 1 dia | `BOLETO_DIAS`; Pix em `api/pedido.js` |
| Cliente reaproveitado no Asaas pelo CPF/CNPJ, sem sobrescrever o cadastro | `api/_asaas.js` |
| Notificações do Asaas (e-mail/SMS) desligadas — SMS é tarifado | `api/_asaas.js` |
| "Combinar entrega" só é aceito enquanto a cotação de frete está fora do ar | `api/pedido.js` |
| Até 10 pedidos por hora por IP | `api/pedido.js` |

## O que ainda falta

1. **Pedido pago → Olist.** O ponto de entrada está em `mudarStatus()`
   (`api/_pedido.js`), hoje só registrando no log.
2. **Etiqueta no Melhor Envio** depois do pedido no Olist (escopos
   `shipping-checkout`, `shipping-generate`, `shipping-print`).
3. **E-mail de confirmação** ao cliente — com as notificações do Asaas
   desligadas, hoje a confirmação é só a página do pedido.
4. Página de trocas e devoluções (CDC).
