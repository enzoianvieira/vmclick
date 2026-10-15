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

### Pelo painel (recomendado)

Aba **Integrações** do painel administrativo: colar um **token pessoal** do
Melhor Envio em "Teste (sandbox)" ou "Produção" e clicar **Salvar e testar** —
o painel cota uma caixa até São Paulo antes de guardar. O token é gerado em
Integrações > Permissões de acesso > Gerar novo token, com a permissão
`shipping-calculate`. Depois, escolher o modo.

Token pessoal não rotaciona, então dispensa o fluxo OAuth abaixo e o cuidado
com o refresh token. Fica cifrado no KV, como as chaves do Asaas (ver
`08-pagamento-asaas.md`). Quando o token vencer, gere outro e cole no painel.

### Pelo fluxo OAuth (alternativa)

Vale quando o painel não tem token para o ambiente em uso.


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

Definidas pela VM Click em outubro de 2026:

| Situação | O que aparece |
|---|---|
| Qualquer CEP | Transportadoras cotadas no Melhor Envio, com preço e data prevista |
| Qualquer CEP | Retirar na loja (Portão) — grátis, pronto em 2 horas |
| Curitiba (`FRETE_CEP_GRATIS`) e pedido a partir de `FRETE_GRATIS_ACIMA` (R$ 500) | Entrega grátis VM Click no prazo do painel (padrão 3 dias úteis) — as transportadoras pagas continuam na lista |
| Curitiba abaixo de R$ 500 | Barra "faltam R$ X para entrega grátis" |
| Curitiba com item fora da entrega grátis | Aviso dizendo qual item; só transportadoras e retirada |
| Curitiba e região (`FRETE_CEP_LOCAL`) | "Precisa em até 24 horas?" — abre o WhatsApp com CEP, endereço e itens; a loja cota ali |
| Nenhuma transportadora atende, ou pedido grande demais | Orçamento pelo WhatsApp |

### Prazo e produtos da entrega grátis

Escolhidos no painel, aba Produtos, e gravados em `data/entrega.js` ao
publicar:

- **Prazo padrão** (1 a 30 dias úteis, começa em 3): vale para todo produto
  sem regra própria.
- **Por produto**: prazo próprio (ex.: item sob encomenda em 7 dias) ou
  "Sem entrega grátis" (ex.: item que a loja não leva no carro).

No carrinho vale o prazo do item mais demorado. Basta um item "sem entrega
grátis" para a opção sair daquele pedido: a loja entrega o pedido inteiro de
uma vez. Arquivo ausente ou ilegível cai no padrão (3 dias, todos dentro).

A entrega própria **paga** (R$ 24,90) deixou de existir. A entrega em até 24h
não é calculada no site (R$ 7/km com mínimo de R$ 20, feita por motoboy ou
Loggi): a loja cota caso a caso pelo WhatsApp.

**Atenção à Vercel:** se `FRETE_GRATIS_ACIMA=299` ou `FRETE_LOCAL` estiverem
definidas no painel da Vercel, apague ou atualize — a variável vence o padrão
do código.

No checkout, o endereço vem antes do frete: as opções só aparecem com o
endereço completo (o CEP preenche rua, bairro e cidade; falta o número). Quem
vai retirar escolhe "Vou retirar na loja" sem precisar de endereço. A
retirada não depende da cotação: funciona mesmo com o Melhor Envio fora do ar.

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

Pagamento (Asaas), criação do pedido no servidor revalidando preço, frete e
estoque, e webhook de confirmação: ver `08-pagamento-asaas.md`. Ainda faltam:

1. Pedido pago → lança no Olist Tiny → compra a etiqueta no Melhor Envio.
2. Página de trocas e devoluções (exigência do CDC).
