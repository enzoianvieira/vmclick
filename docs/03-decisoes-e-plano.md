# VM Click - Decisões travadas e plano de build

Data: 2026-08-12 · Status: **MVP construído e testado** - ver [README.md](../README.md)

## 1. Decisões

| # | Tema | Decisão |
|---|---|---|
| D1 | Plataforma fase 2 | **WordPress + WooCommerce + integração oficial Olist Tiny (ERP)** |
| D2 | Stack do MVP | **Sem framework** - HTML + CSS + JS vanilla, GSAP, three.js pontual. Marcação espelha WooCommerce |
| D3 | ERP | **Olist Tiny** - fonte de verdade de SKU, preço, estoque e pedido |
| D4 | Modelo comercial | **B2C, preço aberto, compra direta** (carrinho + checkout) |
| D5 | Direção visual | **Loja técnica limpa** - branco, verde-petróleo institucional, vermelho só na conversão |
| D6 | Tipografia | **Poppins** (títulos, 600/700) + **Inter** (corpo/UI, 400/500/600), auto-hospedadas |
| D7 | Catálogo demo | **Fictício realista** - ~48 produtos nas 6 categorias reais, em `data/produtos.json`, trocável pelo export do Tiny sem tocar no resto |
| D8 | Imagens de produto | **Ilustrações SVG técnicas** desenhadas no estilo da marca - sem banco de imagem genérico |
| D9 | Animação | **three.js no hero** (cena de circuito/fluxo de energia reativa ao mouse) + **GSAP** no site inteiro (scroll reveals, transição de página, micro-interações) |
| D10 | Escopo | MVP = ambiente de demonstração. Sem pagamento, frete, login ou sincronismo reais |

## 2. Consequências técnicas de D1 + D3

O Tiny é **ERP, não loja**: não tem checkout nem gateway. Logo o WooCommerce continua necessário como camada de vitrine + pedido, e o Tiny sincroniza produto/preço/estoque/pedido por cima dele.

Divisão de responsabilidade na fase 2:

| Camada | Dono |
|---|---|
| Cadastro de produto, preço, estoque, NF-e | **Olist Tiny** |
| Vitrine, busca, carrinho, checkout, pagamento | **WooCommerce** |
| Design, animação, componentes, conteúdo institucional | **Tema custom** (este projeto) |

**Riscos a validar antes da fase 2:**
1. Versão do WooCommerce suportada pela integração do Tiny - a documentação pública é ambígua quanto às versões. Confirmar com o suporte Olist.
2. Volume: +30.000 SKUs no WooCommerce exige busca indexada (não a busca nativa do WP) e cuidado com `wp_postmeta`.
3. Se nem todos os 30.000 itens forem para o site, definir a regra de recorte no Tiny (por exemplo, tag ou categoria "publicar no site").

## 3. Plano de build do MVP

```
vmclick/
├─ index.html                 Home (hero three.js, categorias, destaques, prova social)
├─ produtos.html              Vitrine - busca, filtros, ordenação, paginação
├─ categoria.html             Listagem por categoria
├─ produto.html               PDP - galeria, specs, frete simulado, relacionados
├─ carrinho.html
├─ finalizar.html             Checkout mock, 3 passos
├─ servicos.html
├─ quem-somos.html
├─ contato.html
├─ assets/
│  ├─ css/  tokens.css · base.css · components.css · pages.css
│  ├─ js/   app.js · cart.js · catalog.js · hero-3d.js · animations.js
│  ├─ fonts/  Poppins + Inter (woff2, auto-hospedadas)
│  ├─ img/    logo.svg · pictogramas SVG · ilustrações de produto
│  └─ vendor/ gsap · three (versionados localmente, sem CDN)
└─ data/produtos.json         Catálogo trocável pelo export do Tiny
```

Convenções de marcação (para o porte ao WordPress ser troca de template):
`.products` · `.product` · `.woocommerce-loop-product__title` · `.price` · `.add_to_cart_button` · `.woocommerce-breadcrumb` · `.cart_totals`

## 3.1 Desvios do plano original (e por quê)

| Planejado | Entregue | Motivo |
|---|---|---|
| `data/produtos.json` | `data/produtos.js` (`window.VM_PRODUTOS`) | `fetch` não funciona em `file://`. Com JS, o cliente abre o demo com duplo clique, sem servidor. Continua sendo arquivo único e substituível. |
| Sprite SVG externo | Sprite injetado por `assets/js/sprite.js` | Mesmo motivo, mais o fato de que `<use>` externo não herda estilos de forma confiável entre navegadores. |
| Galeria de PDP com miniaturas | Imagem única + aviso "ilustração técnica" | Miniaturas falsas do mesmo ícone enganariam o cliente. As fotos reais chegam com o Tiny. |
| 48 produtos | 53 produtos em 5 categorias | "Projetos e serviços" virou página própria (`servicos.html`) em vez de categoria de produto - não se vende projeto pelo carrinho. |

## 4. Premissas assumidas (avisar se alguma estiver errada)

1. **Logo:** vou vetorizar o logo atual para SVG a partir do PNG. Se existir o arquivo vetorial original (AI/EPS/SVG), me passe - o resultado fica melhor.
2. **Fotos da loja/equipe:** não há material próprio disponível; a home não vai depender de foto. Se houver fotos reais da loja no Portão, entram na página Quem Somos.
3. **Bibliotecas:** GSAP e three.js versionadas dentro do projeto, sem CDN - funciona offline e não vaza requisição para terceiros (LGPD).
4. **Fontes:** auto-hospedadas em woff2, sem chamada ao Google Fonts.
5. **Aviso de demonstração:** toda tela de compra exibe faixa informando que nenhum pedido é processado.
6. **Idioma:** só pt-BR. Sem dark mode no site público (o styleguide tem, o site não).


## 5. Vitrine curada (25/08/2026)

O site deixou de espelhar o catálogo inteiro do Olist e passou a publicar um **recorte curado**.

| Item | Estado |
|---|---|
| Produtos removidos do site | 2.401 |
| Produtos no site agora | 0, até a lista curada ser sincronizada |
| Excluídos no Olist | **nenhum** — todos os scripts do projeto só fazem `GET` |
| Restaurar catálogo anterior | `git show HEAD:data/produtos.js > data/produtos.js` |

**Como a curadoria funciona:** `scripts/skus-site.txt` lista os SKUs que vão para o site,
um por linha, com comentário livre após `#`. Existindo a lista, `npm run sync-site`
traz somente esses produtos do Olist. Apagar o arquivo volta a sincronizar tudo.

O filtro acontece já na listagem (`GET /produtos` devolve o `sku`), então
sincronizar 19 itens custa uma varredura de listagem mais 19 chamadas de detalhe,
em vez de 2.401.

**Categoria vazia não aparece.** Como o catálogo virou um recorte, `VM.categoriasAtivas()`
esconde do menu, do rodapé, da home e da página de categoria toda categoria sem produto:
categoria vazia leva o cliente para uma vitrine sem nada. A faixa de marcas segue a mesma
regra, porque as marcas são derivadas dos produtos.
