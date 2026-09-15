# Cotação de frete — Melhor Envio

Cotação real de frete na página do produto e no passo de entrega do checkout.

## Por que Melhor Envio

Uma API só devolve Jadlog, Correios, Loggi, Azul Cargo e LATAM Cargo, sem
contrato com cada transportadora. Tem sandbox, e emite a etiqueta depois —
fechando o ciclo com o Olist Tiny, que já recebe o pedido.

As alternativas consideradas: SuperFrete (mais simples, mas só três
transportadoras e a Jadlog só libera depois da primeira postagem), Frenet
(equivalente) e Jadlog direto (exige contrato e conta corrente, e deixa a loja
sem alternativa quando a Jadlog não atende o CEP).

## Como está montado

```
produto.html / finalizar.html
        │  { cep, itens: [{sku, qtd}], subtotal }
        ▼
POST /api/frete/cotar          ← público, sem sessão
        │
        ├─ api/_frete.js       ← catálogo, pacote, token, chamada à API
        └─ api/_credenciais.js ← guarda o refresh token rotacionado
```

**O navegador nunca manda peso, medida ou preço.** Só SKU e quantidade: o resto
é lido do catálogo no servidor. Quem manda o pacote manda o preço do frete, e
isso não pode sair do lado do cliente.

O token também fica só no servidor — ele permite **comprar etiqueta** com o
saldo da conta, não apenas cotar.

## Configuração

1. Criar conta e um aplicativo no Melhor Envio. Comece pelo sandbox
   (`https://sandbox.melhorenvio.com.br`), que simula sem cobrar e atende
   Correios e Jadlog.
2. Preencher no painel da Vercel (nunca no repositório) as variáveis da seção
   "Frete" do `.env.example`.
3. Cadastrar no aplicativo a URL de redirecionamento:
   `https://vmclick.vercel.app/api/callback-melhorenvio` — igual à de
   `MELHORENVIO_REDIRECT_URI`.

   O Melhor Envio **recusa http**, inclusive `localhost`. Por isso a
   autorização volta para `api/callback-melhorenvio.js`, no site publicado:
   ela mostra o código na tela e você cola no terminal. Essa página precisa
   estar no ar antes do passo 4.
4. Rodar `npm run get-token-frete`. Ele abre o browser, você autoriza, copia o
   código da página de retorno e cola no terminal; os tokens caem no `.env`.
   Copie o `MELHORENVIO_REFRESH_TOKEN` para a Vercel.
   (`npm run get-token-frete:refresh` renova depois, sem browser.)
5. Preencher `FRETE_CEP_ORIGEM` com o CEP da loja — **sem isso a cotação
   responde 503**.
6. Quando estiver valendo, trocar `MELHORENVIO_AMBIENTE` para `producao` e
   refazer o passo 4: token de sandbox não vale em produção.

## Testar na sua máquina

`npm run dev:estatico` serve **só arquivos** — um POST para `/api/frete/cotar`
responde `405 Method Not Allowed`, porque as funções não rodam ali. Isso é
esperado, não é defeito da integração. Para exercitar a cotação de verdade:

```bash
npx vercel dev
```

Sobe o site e as funções na mesma porta, lendo o `.env`.

### Atenção ao KV

O `refresh_token` do Melhor Envio rotaciona. Sem KV configurado
(`KV_REST_API_*` ou `UPSTASH_REDIS_REST_*`) ele não tem onde ser gravado, e a
cotação para de funcionar quando o token atual expirar — o mesmo tropeço que já
houve com o Olist. O mesmo KV atende as duas integrações.

## Regras da loja

| Situação | O que aparece |
|---|---|
| Qualquer CEP | Retirar na loja — grátis |
| CEP em `FRETE_CEP_LOCAL` | Entrega VM Click — `FRETE_LOCAL`, grátis acima de `FRETE_GRATIS_ACIMA` |
| Qualquer CEP | Transportadoras cotadas no Melhor Envio |

Padrão de `FRETE_CEP_LOCAL`: Curitiba (80000-000 a 82999-999) e região
metropolitana (83000-000 a 83800-999). **Confirmar essas faixas com a loja** —
foram deduzidas da numeração dos CEPs, não de uma lista de atendimento real.

A retirada na loja nunca vem pré-selecionada, mesmo custando zero: quem digita
um CEP de outro estado não pode sair do passo com "retirar em Curitiba" marcado
sem ter percebido. A pré-seleção é a entrega mais barata.

## Limites e dados ruins

**Peso e medida vêm do Olist e nem sempre prestam.** Há lâmpada de 6 W cadastrada
com `"Peso líquido": "56 kg"` — grama digitado no campo de quilo. Acima de 40 kg
o dado é tratado como não confiável e o item entra com a embalagem padrão
(16×8×20 cm, 600 g); a resposta traz `pesoEstimado: true` e a tela avisa que o
valor é confirmado antes do envio.

Isso é remendo, não solução: **corrigir o cadastro no Olist** é o que faz a
cotação ficar correta. Enquanto não for corrigido, o frete cotado é aproximado.

Acima de 30 kg ou 200 cm somados, o pedido passa do que a encomenda comum
aceita — comum aqui, com rolo de cabo, eletroduto e lata de tinta. Nesse caso as
transportadoras saem da lista, a retirada na loja continua valendo e aparece um
botão de orçamento pelo WhatsApp.

Se a cotação falhar (API fora do ar, token vencido), o checkout oferece
"Combinar entrega com a loja" para o pedido não travar no passo 2.

## O que ainda falta para vender de verdade

Isto cobre **só o frete**. O passo de pagamento continua sendo demonstração.
Para fechar venda ainda faltam:

1. Gateway de pagamento (Mercado Pago, Pagar.me ou Stripe), com checkout
   hospedado ou tokenização — campo de cartão na própria página joga a loja
   dentro do escopo pesado de PCI-DSS.
2. Criação do pedido no servidor, **revalidando preço e estoque**. Hoje o preço
   vem do `data/produtos.js` no navegador; um checkout que confie nisso pode ser
   fraudado pelo DevTools.
3. Webhook de confirmação → lança o pedido no Olist Tiny → compra a etiqueta no
   Melhor Envio.
4. Página de trocas e devoluções (exigência do CDC).
