# Vitrine curada: remoção do catálogo e lista de SKUs

**Data:** 25/08/2026
**Pedido do cliente:** remover os produtos que estavam no site, sem excluir nada no Olist.
Em seguida, publicar apenas 19 produtos específicos (iluminação e acabamentos elétricos).

---

## 1. O que foi feito

### 1.1 Produtos removidos do site

Os **2.401 produtos** que o site exibia foram removidos de `data/produtos.js`.

O que **não** aconteceu: nada foi excluído no Olist. Auditei o projeto inteiro antes de
mexer em qualquer coisa. Todos os scripts que falam com o Olist usam exclusivamente `GET`:

```
scripts/sync-tiny.js        GET /produtos
scripts/enrich-produtos.js  GET /produtos, GET /produtos/{id}
scripts/fetch-categorias.js GET /categorias
```

O único `POST` do projeto está em `scripts/get-token.js` e aponta para o endpoint de token
OAuth (`accounts.tiny.com.br/.../token`). Não toca em produto.

**Restaurar o catálogo anterior**, se necessário:

```bash
git show HEAD~1:data/produtos.js > data/produtos.js
```

### 1.2 Interface ajustada para o catálogo vazio

Esvaziar a vitrine sem mexer na interface deixaria o site com buracos: 14 departamentos no
menu levando a 14 vitrines vazias, e uma faixa de marcas anunciando "Tigre, 210 produtos"
sem produto nenhum por trás. Foram feitos estes ajustes:

| Ajuste | Onde |
|---|---|
| `VM.categoriasAtivas()`: categoria sem produto não aparece | `assets/js/app.js` |
| Menu, mega-menu, rodapé e hero passam a usar só categorias ativas | `app.js`, `index.html` |
| Cards de categoria na home: só as ativas, com contagem real | `assets/js/catalog.js` |
| Filtro de categoria da vitrine: só as ativas | `assets/js/catalog.js` |
| "Outras categorias" na página de categoria: só as ativas | `categoria.html` |
| Faixa de marcas some inteira quando não há marcas | `index.html` |
| `data/marcas.js` zerado (marcas são derivadas dos produtos) | `data/marcas.js` |

Vitrines de destaques e ofertas já se escondiam sozinhas quando vazias.

**Verificação:** 7 páginas testadas (início, produtos, categoria, serviços, quem somos,
blog, contato). Header e rodapé de pé, estados vazios com texto explicativo, zero imagem
quebrada, zero rolagem horizontal, zero erro de console.

### 1.3 Lista curada de SKUs

Criado `scripts/skus-site.txt` com os 19 SKUs pedidos, separados nos dois grupos
(Iluminação e Acabamentos Elétricos), cada linha com o nome do produto como comentário.

`scripts/enrich-produtos.js` passou a respeitar essa lista:

- **Existindo o arquivo com pelo menos um SKU**, o sync traz somente esses produtos.
- **Apagando o arquivo** (ou esvaziando a lista), volta a sincronizar o catálogo inteiro.
- Comparação de SKU não diferencia maiúsculas de minúsculas.
- Ao final da listagem, o script informa quantos SKUs achou e **lista nominalmente os que
  não encontrou**, sugerindo rodar com `TINY_SITUACAO=` vazio caso o produto esteja
  inativo no Olist.

O filtro acontece já na listagem, porque `GET /produtos` devolve o `sku`. Sincronizar 19
itens custa uma varredura de listagem mais 19 chamadas de detalhe, em vez de 2.401.

Adicionado o atalho `npm run sync-site` (alias de `enrich-produtos`).

---

## 2. O que ficou pendente e por quê

Os 19 produtos **ainda não estão no site**. Dois motivos, nesta ordem:

**1. Nenhum dos 19 SKUs existe na cópia local.** A sincronização de 14/08 trouxe uma fatia
parcial do Olist (2.401 itens com `situacao=A`) e esses produtos ficaram de fora. Busquei
também por nome: `MILUZ`, `MUNDILUX`, `EMPALUX`, `BLUMENAU`, `BULBO`, `PAINEL LED` —
zero ocorrências. O cache local (`scripts/.cache/`, 2.401 arquivos) também não tem nenhum.

**2. As credenciais do Olist expiraram.** O `access_token` venceu em 14/08 e o
`refresh_token` também não vale mais:

```
npm run get-token:refresh
FALHA: HTTP 400 — invalid_grant: Token is not active
```

Renovar exige login no navegador em `accounts.tiny.com.br`, o que depende do cliente.

### Como concluir

```bash
npm run get-token
```

Abre o navegador para autorizar. Depois:

```bash
npm run sync-site
```

Traz os 19 produtos com nome, preço, estoque, imagens e especificações, regenera
`data/produtos.js` e `data/marcas.js`.

---

## 3. Recomendação para depois do sync

A home foi desenhada para um catálogo grande: vitrine rolante, faixa de marcas, grade de
departamentos. Com 19 produtos em duas ou três categorias, vale revisar o arranjo — uma
grade única com os 19 itens tende a funcionar melhor do que três vitrines competindo pelo
mesmo punhado de produtos.
