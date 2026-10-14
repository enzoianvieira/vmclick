# Pedidos, expedição, e-mails e Minha conta

## Como o pedido anda

```
checkout ── cria o pedido (aguardando) ──► e-mail "pedido recebido" (Pix/boleto)
   │
Asaas confirma (webhook / cartão aprovado) ──► pago
   │   ├─ lança no Olist (contato + pedido "Aprovada")      api/_expedicao.js
   │   └─ e-mail "pagamento confirmado"
   ▼
painel > Pedidos: Em separação ─► Enviado (+ rastreio) ─► Entregue
                                     ├─ rastreio no despacho do Olist
                                     └─ e-mail "pedido enviado"
```

Na retirada na loja, "Enviado" vira **Pronto para retirar** e "Entregue" vira
**Retirado**. O cliente acompanha tudo na página do pedido (linha do tempo) e
em **Minha conta**.

## Olist: o que fica lá

Nota fiscal, separação, baixa de estoque e etiqueta continuam no Olist. O
site cria o pedido de venda já **Aprovado**, com:

- contato achado pelo CPF/CNPJ (ou cadastrado);
- itens pelo código (SKU) — o produto precisa existir no Olist com o mesmo código;
- frete, desconto do Pix, endereço de entrega;
- o número do site (VM-10001) em **Ordem de compra** e nas observações.

**Antes de valer:** o aplicativo do Olist precisa das permissões de **Pedidos**
e **Contatos** (hoje só tem Produtos). Marque as duas no aplicativo em
Configurações > Aplicativos API v3 e autorize de novo com `npm run get-token`.
Sem isso o Olist responde 403 e o pedido fica no painel com "erro" — o botão
**Enviar ao Olist** tenta de novo depois de liberado.

Falha no Olist nunca desfaz o pagamento. Uma trava no KV impede pedido
duplicado quando dois avisos de pagamento chegam juntos.

## Painel > Pedidos

Primeira aba do painel. Filtros (para expedir, aguardando pagamento, enviados,
entregues, estorno/contestação, todos), busca por número ou nome, e o detalhe
com cliente, entrega, itens, pagamento, número no Olist e histórico. Mostra os
300 pedidos mais recentes.

Pedido não expira mais no KV: é o histórico do painel e do cliente.

## E-mails (Resend)

Configurar em **painel > Integrações > E-mail**: chave (`re_…`) e remetente,
ex.: `VM Click <pedidos@vmclick.com.br>`. "Salvar e testar" confere a chave e
se o domínio do remetente está verificado; "Enviar teste" manda um e-mail.

1. Criar conta em resend.com (grátis até 3.000 e-mails/mês, 100 por dia).
2. **Domains > Add domain** `vmclick.com.br` e criar os registros DNS que ele
   mostrar. Sem domínio verificado, o Resend só entrega para o e-mail do dono
   da conta.
3. **API Keys > Create** (Sending access) e colar no painel.

Alternativa: variáveis `RESEND_API_KEY` e `EMAIL_REMETENTE`.

E-mail é aviso, nunca condição: sem Resend o checkout funciona igual, só não
avisa — e o "Minha conta" não consegue mandar o código.

Avisos repetidos (webhook que chega duas vezes) não viram e-mail repetido: cada
aviso vai com uma chave única para o Resend.

## Minha conta (sem senha)

`conta.html`, com o ícone de pessoa no topo do site. O cliente digita o e-mail,
recebe um código de 6 dígitos e entra. Vê os pedidos feitos com aquele e-mail,
mesmo os de antes de "ter conta".

- Código vale 10 minutos e 5 tentativas; guardado só como hash.
- Até 5 códigos por hora por e-mail e 15 por IP.
- A resposta é a mesma exista pedido ou não (não revela quem é cliente).
- Sessão de 30 dias num cookie HttpOnly assinado com chave **derivada** de
  `SESSAO_SEGREDO` — diferente da do painel: cookie de cliente nunca abre o
  painel.

## Limite de funções da Vercel

Com `api/conta.js` e `api/pedidos-admin.js` o projeto tem **12 funções**, o
teto do plano Hobby. A próxima rota nova precisa juntar duas existentes (por
exemplo `produtos/buscar` e `produtos/detalhe`) ou o plano Pro.
