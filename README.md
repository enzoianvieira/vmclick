# VM Click

Vitrine e-commerce estática (HTML/CSS/JS puro) com sincronização de catálogo a partir do **Olist ERP (API v3)**.

O site roda em `file://` ou por qualquer servidor estático. O catálogo (`data/produtos.js` e `data/marcas.js`) é regenerado sob demanda por scripts Node que consomem a API do Olist.

---

## Sumário

- [Setup rápido](#setup-rápido)
- [Integração Olist ERP](#integração-olist-erp)
  - [Como funciona](#como-funciona)
  - [1. Criar aplicativo no Olist](#1-criar-aplicativo-no-olist)
  - [2. Configurar `.env`](#2-configurar-env)
  - [3. Autorizar (OAuth2)](#3-autorizar-oauth2)
  - [4. Baixar categorias](#4-baixar-categorias)
  - [5. Enriquecer catálogo](#5-enriquecer-catálogo)
- [Scripts disponíveis](#scripts-disponíveis)
- [O que foi implementado](#o-que-foi-implementado)
- [Arquitetura e decisões](#arquitetura-e-decisões)
- [Estrutura de arquivos](#estrutura-de-arquivos)
- [Manutenção](#manutenção)
- [Fase 2 (WordPress)](#fase-2-wordpress)

---

## Setup rápido

Já tem `.env` configurado com tokens válidos?

```powershell
npm run enrich-produtos:cache   # regenera catálogo a partir do cache local
npm run dev                     # sobe servidor em http://localhost:4321
```

Primeira instalação: siga a [seção de integração Olist](#integração-olist-erp).

Requisitos: **Node 18+** (usa `fetch` nativo, zero dependências npm).
Só para reprocessar imagens: **ffmpeg com libwebp** no PATH (ver [Trocar ou adicionar imagens](#trocar-ou-adicionar-imagens)).

---

## Integração Olist ERP

### Como funciona

Fluxo unidirecional **Olist → site estático**:

```
Olist ERP (API v3)
     │
     │  OAuth2 Bearer
     ▼
scripts/get-token.js  ─── grava tokens em .env
     │
     ▼
scripts/fetch-categorias.js  ─── árvore de categorias → scripts/categorias.json
     │
     ▼
scripts/enrich-produtos.js  ─── produtos detalhados (com cache local)
     │
     ├─► data/produtos.js   (5000+ produtos com preços, estoque, imagens, categorias)
     └─► data/marcas.js     (top 20 marcas do catálogo)
     │
     ▼
Site estático (HTML/JS)  ─── consome window.VM_PRODUTOS, VM_CATEGORIAS, VM_MARCAS
```

Nenhuma escrita no Olist. Apenas leitura via `GET`.

### 1. Criar aplicativo no Olist

1. Painel Olist → **Configurações → Aplicativos API v3**
2. **Criar novo aplicativo**
3. Marcar **apenas as permissões necessárias** (leitura):
   - **Produtos** (obrigatório)
   - **Categorias** (obrigatório para árvore)
   - **Marcas** (opcional — se quiser dados de marca)
   - **Estoque** (opcional — se quiser saldo separado)
   - **Lista de Preços** (opcional)
4. **URL de redirecionamento:** `http://localhost:3000/callback`
5. Copiar `Client ID` e `Client Secret`

### 2. Configurar `.env`

```powershell
cp .env.example .env
```

Preencher:

```
TINY_CLIENT_ID=<seu-client-id>
TINY_CLIENT_SECRET=<seu-client-secret>
TINY_REDIRECT_URI=http://localhost:3000/callback
TINY_ACCESS_TOKEN=
TINY_REFRESH_TOKEN=
TINY_PAGE_SIZE=100
TINY_SITUACAO=A
```

`.env` está no `.gitignore`. Nunca commite.

### 3. Autorizar (OAuth2)

```powershell
npm run get-token
```

O que acontece:
1. Sobe servidor local em `:3000`
2. Abre o navegador na tela de login do Olist
3. Após autorizar, captura o `code` no callback
4. Troca por `access_token` (4h) e `refresh_token` (24h)
5. Grava ambos em `.env`

Se token expirar (após 4h):
```powershell
npm run get-token:refresh   # renova sem browser (usa refresh_token)
```

Se refresh também expirar (após 24h), rodar `npm run get-token` de novo.

### 4. Baixar categorias

```powershell
npm run fetch-categorias
```

Gera:
- `scripts/categorias-olist.json` — árvore bruta do Olist (referência)
- `scripts/categorias.json` — categorias top-level do Olist + mapping ID → slug

**Regra de mapping:** cada categoria top-level do Olist vira uma categoria do site. Subcategorias são resolvidas pela ancestralidade (categoria filha herda o slug da top-level).

### 5. Enriquecer catálogo

Fluxo completo (baixa detalhe de cada produto):

```powershell
npm run enrich-produtos
```

O que faz:
1. Lista todos os IDs de produtos ativos via `GET /produtos` (paginado)
2. Para cada ID, chama `GET /produtos/{id}` — retorno completo (marca, categoria, preços, estoque, imagens, dimensões, GTIN, NCM)
3. Salva cada produto em `scripts/.cache/produto-{id}.json`
4. Aplica **regras de sub-categorização** por palavra-chave (ver [regras-catalogo.js](#curadoria-de-sub-categorias))
5. Extrai **top 20 marcas** do catálogo
6. Ordena: `estoque > 0` primeiro, `com imagem` antes de `sem imagem`, `esgotados` no fim
7. Gera `data/produtos.js` e `data/marcas.js`
8. Faz backup do arquivo anterior em `data/produtos.js.bak`

**Tempo estimado:** ~2 segundos por produto (rate limit Olist ~30 req/min no plano free). 5000 produtos = ~3h.

**Cache é persistente.** Se interromper (Ctrl+C, queda de rede, token expirar), roda de novo e retoma automaticamente:
```powershell
npm run enrich-produtos       # continua de onde parou
```

**Modos:**
```powershell
npm run enrich-produtos             # completo (baixa + grava)
npm run enrich-produtos:dry         # simula: baixa e cacheia, mas não grava data/produtos.js
npm run enrich-produtos:cache       # só cache local, zero requests ao Olist
```

Use `:cache` quando quiser regenerar `data/produtos.js` **sem esperar** (ex.: depois de ajustar regras de categorização em `scripts/regras-catalogo.js`).

Ignorar cache e rebaixar tudo:
```powershell
node scripts/enrich-produtos.js --force
```

---

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor local em `http://localhost:4321` |
| `npm run get-token` | OAuth flow completo (browser + servidor local) |
| `npm run get-token:refresh` | Renova access_token via refresh_token |
| `npm run fetch-categorias` | Baixa árvore de categorias do Olist |
| `npm run enrich-produtos` | Baixa detalhe de todos os produtos (com cache) |
| `npm run enrich-produtos:dry` | Simula: baixa mas não grava `data/produtos.js` |
| `npm run enrich-produtos:cache` | Regenera `data/produtos.js` a partir do cache local (sem requests) |
| `npm run sync-tiny` | Sync leve: só lista produtos, sem detalhe (legado — use `enrich`) |
| `npm run derivar-marcas` | Deriva a marca pelo nome do produto e regenera `data/marcas.js` (sem API) |
| `npm run derivar-marcas:dry` | Só o relatório de detecção, sem escrever |
| `npm run otimizar-imagens` | Gera as imagens servidas pelo site a partir de `assets/img/_originais/` (precisa de ffmpeg) |
| `npm run otimizar-imagens:force` | Idem, reprocessando tudo mesmo que a saída já exista |

---

## O que foi implementado

### Integração
- ✅ OAuth2 authorization code flow com servidor callback local
- ✅ Refresh token flow
- ✅ Consumo da API v3 (`GET /produtos`, `GET /produtos/{id}`, `GET /categorias/todas`)
- ✅ Rate limit adaptativo (respeita headers `X-RateLimit-*`)
- ✅ Cache persistente por produto (`scripts/.cache/produto-{id}.json`)
- ✅ Retry com backoff em erros de rede, HTTP 429 e 5xx
- ✅ Retomada automática após interrupção

### Categorias
- ✅ Detecção automática das top-level do Olist (4 no MVP: Elétrica, Ferramentas, Utilidades, Vestuários)
- ✅ Mapping por ancestralidade (categoria filha → slug da ancestral top-level)
- ✅ **15 sub-categorias curatoriais** por palavra-chave (Disjuntores, Cabos, Tomadas, LED, EPI, Limpeza, Ferragens, etc)
- ✅ Ícone e descrição por categoria
- ✅ Só entram no site categorias que **têm produtos**

### Marcas
- ✅ Extração automática das top 20 marcas do catálogo real
- ✅ **Derivação por nome de produto** quando o Olist devolve `marca` vazia (regras em `scripts/regras-marcas.js`)
- ✅ Cores da esteira geradas dinamicamente
- ✅ Home consome `data/marcas.js` em vez de lista hardcoded

### Curadoria da home
- ✅ `data/curadoria.js` define "Destaques da loja" (por SKU) e "Ofertas da semana" (SKU + preço de referência)
- ✅ Arquivo editável à mão, nunca sobrescrito pelo sync
- ✅ Fallback determinístico: sem curadoria, os destaques são escolhidos por categoria/estoque
- ✅ Vitrine rolante (`VM.renderVitrine`) com autoplay, setas, arrasto e pausa em hover/foco

### Blog
- ✅ `blog.html` + 3 posts técnicos, com "leia também" e CTA
- ✅ Índice único em `data/blog.js` alimenta listagem e relacionados

### Produtos
- ✅ Sync de campos completos: SKU, nome, descrição, preço, preço promocional, estoque, unidade, GTIN, NCM, dimensões, peso, marca, imagens
- ✅ Ordenação: estoque > 0 primeiro, com imagem antes de sem imagem, esgotados no fim
- ✅ Cards renderizam imagem real quando existe (fallback: SVG placeholder)
- ✅ PDP com galeria de fotos + miniaturas clicáveis

### UX
- ✅ Paginação condensada (`1 … 57 58 59 … 116`) — antes renderizava centenas de botões
- ✅ Input "ir pra página X" quando >10 páginas
- ✅ 30 produtos por página
- ✅ Sidebar de filtros com scroll interno (fix: antes travava com muitas categorias)
- ✅ Responsivo: mobile bottom-sheet pros filtros, PDP em 1 col, thumbs menores

---

## Arquitetura e decisões

### Por que site estático?

MVP não tem backend. O redesign roda em `file://` (cliente pode abrir com duplo-clique no `index.html`) ou por qualquer servidor estático. Catálogo vive em `data/produtos.js` (não `.json` — pra funcionar sem `fetch` no `file://`).

### Por que Node scripts em vez de backend?

Sync roda **on-demand** na máquina de dev. Zero infra necessária. Cache local reduz custo de API drasticamente. Quando o site migrar pra WordPress (fase 2), o plugin oficial Tiny ↔ WooCommerce substitui esta pipeline.

### Curadoria de sub-categorias

Olist tem só 4 categorias top-level, insuficiente pra navegação. Solução: regras de detecção por palavra-chave no `nome` do produto, em `scripts/regras-catalogo.js`:

```js
{ slug: 'disjuntores', match: /disjuntor|idr|dps/i, parent: 'eletrica', ... }
{ slug: 'cabos-fios',  match: /\bcabo\b|\bfio\b/i,  parent: 'eletrica', ... }
// ...
```

Primeira regra que bater vence. Se nenhuma bater, produto fica na top-level Olist. Editar o arquivo e rodar `npm run enrich-produtos:cache` recria o catálogo em segundos (sem API call).

### Rate limit

Olist retorna `X-RateLimit-Remaining` e `X-RateLimit-Reset` em cada resposta. Script pausa proativamente quando `remaining <= 2` e aguarda `reset` segundos. Em `HTTP 429`, retry automático após o reset.

### Cache

Cada produto vira `scripts/.cache/produto-{id}.json`. `enrich-produtos.js` verifica cache antes de baixar (skip). Isso torna:
- **Retomada gratuita** após qualquer interrupção
- **Regeneração instantânea** do `data/produtos.js` quando muda a lógica de mapping (`:cache`)
- **Isolamento** entre pipeline de dados e transformação

Cache é local, ignorado no git.

### Segurança

- OAuth2 com `state` param anti-CSRF
- Escopo mínimo (só permissões de leitura marcadas no aplicativo Olist)
- `.env` no `.gitignore` (contém `client_secret`, `access_token`, `refresh_token`)
- Scripts só fazem `GET` — impossível escrever/modificar/deletar no Olist

---

## Estrutura de arquivos

```
vmclick/
├─ index.html · produtos.html · categoria.html · produto.html
├─ carrinho.html · finalizar.html · servicos.html
├─ quem-somos.html · contato.html · politica.html
├─ blog.html · blog-dimensionar-disjuntor-cabo.html
├─ blog-temperatura-cor-led.html · blog-checklist-eletrica-obra.html
│
├─ data/
│  ├─ produtos.js       ← gerado por enrich (window.VM_PRODUTOS + VM_CATEGORIAS)
│  ├─ marcas.js         ← gerado por enrich/derivar-marcas (window.VM_MARCAS)
│  ├─ curadoria.js      ← EDITÁVEL: destaques e ofertas da home (window.VM_CURADORIA)
│  └─ blog.js           ← EDITÁVEL: índice dos posts (window.VM_POSTS)
│
├─ scripts/
│  ├─ get-token.js           ← OAuth2 flow
│  ├─ fetch-categorias.js    ← baixa árvore de categorias
│  ├─ enrich-produtos.js     ← baixa detalhes, aplica regras, gera data/*.js
│  ├─ regras-catalogo.js     ← regras de sub-categorização (editável)
│  ├─ regras-marcas.js       ← regras de detecção de marca por nome (editável)
│  ├─ derivar-marcas.js      ← preenche marca e regenera data/marcas.js (sem API)
│  ├─ sync-tiny.js           ← sync leve legado (só lista)
│  ├─ categorias.json        ← gerado (top-level + mapping)
│  ├─ categorias-olist.json  ← árvore bruta (ignorado no git)
│  └─ .cache/                ← cache por produto (ignorado no git)
│
├─ assets/
│  ├─ css/  tokens · base · components · pages · fonts
│  ├─ js/   app · cart · catalog · animations · hero-3d · sprite
│  ├─ fonts/ Poppins + Inter
│  ├─ img/
│  │  ├─ _originais/  ← PNGs de origem (entrada do otimizar-imagens)
│  │  ├─ brand/       ← lockup claro/escuro, símbolo, favicons
│  │  ├─ banners/     ← 3 promos × (desktop 1920 / mobile 800) × (webp + jpg)
│  │  └─ loja/        ← fachada · interior · painel, em 1600 e 900, webp + jpg
│  └─ vendor/ gsap · ScrollTrigger · three
│
├─ design-system/  tokens.css · preview.html
├─ docs/
│  ├─ 01-analise-site-atual.md
│  ├─ 03-decisoes-e-plano.md
│  └─ 04-integracao-tiny.md  ← doc detalhada da integração
│
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md  ← você está aqui
```

---

## Manutenção

### Atualizar catálogo (rotina)

```powershell
npm run get-token:refresh          # renova token se >4h desde último uso
npm run enrich-produtos            # baixa novos produtos, atualiza os cacheados
```

Não precisa `fetch-categorias` toda vez — só se você criou/removeu categorias no Olist.

### Ajustar categorização

Editar `scripts/regras-catalogo.js` (adicionar/remover regras, ajustar regex). Depois:

```powershell
npm run enrich-produtos:cache
```

Instantâneo — usa cache, não bate na API.

### Ajustar marcas detectadas

O Olist devolve `marca` vazia na maior parte do catálogo. As regras de detecção
por nome ficam em `scripts/regras-marcas.js`. Depois de editar:

```powershell
npm run derivar-marcas:dry     # relatório: quantos casaram, top 20, sem gravar
npm run derivar-marcas         # aplica; só preenche quem está vazio
node scripts/derivar-marcas.js --force   # re-deriva tudo (use após mexer nas regras)
```

Marca vinda do ERP sempre vence a derivação. O mesmo fallback roda dentro do
`enrich-produtos.js`, então um sync novo já nasce com marca preenchida.

### Trocar destaques e ofertas da home

Editar `data/curadoria.js` (SKUs e preços de referência) e recarregar a página.
Nenhum script, nenhum build — o arquivo não é gerado nem sobrescrito pelo sync.

### Publicar um post no blog

1. Duplicar um `blog-*.html` e escrever o conteúdo
2. Acrescentar a entrada no topo de `data/blog.js`

### Ajustar cores/nomes de marcas

Editar `CORES_MARCA` em `scripts/enrich-produtos.js` (array de hex codes). Depois:

```powershell
npm run enrich-produtos:cache
```

### Limpar cache (baixar tudo do zero)

```powershell
Remove-Item -Recurse -Force scripts/.cache
npm run enrich-produtos
```

### Trocar ou adicionar imagens

Fluxo: **original entra em `assets/img/_originais/`, o script gera o resto.**

```powershell
# 1. coloque/substitua o PNG em assets/img/_originais/
# 2. gere as versões servidas pelo site
npm run otimizar-imagens
```

O script só reprocessa o que mudou (compara data de modificação). Para forçar tudo,
`npm run otimizar-imagens:force`. Depende do **ffmpeg com libwebp** no PATH — não usa pacote npm.

O plano de saída fica em três listas no topo de `scripts/otimizar-imagens.js`:

| Lista | Gera | Onde aparece |
|---|---|---|
| `MARCA` | PNG com alfa, várias alturas | Header (`logo-lockup`), rodapé (`logo-lockup-dark`), favicons |
| `BANNERS` | webp + jpg, par 1920/800 | Carrossel da home (`VM.initCarrossel`) |
| `FOTOS` | webp + jpg, 1600 e 900 | Quem somos, Contato, Serviços, bloco "Quem somos" da home |

Para trocar um banner do carrossel, substitua o par `banner_desktopN.png` / `banner_mobileN.png`,
rode o script e ajuste o `alt` e o link do slide em `index.html`.

Referência de tamanho: os 12 originais somam ~13 MB; as 30 versões geradas somam ~2,8 MB,
e cada página carrega apenas uma fração disso.

### Trocar produtos por dados curados

Se quiser sobrescrever campos manualmente, edite `data/produtos.js` — **mas** o próximo `enrich` vai sobrescrever. Alternativa: adicione uma coluna de override em uma fonte externa e mescle no `mapDetalhe()` de `enrich-produtos.js`.

---

## Fase 2 (WordPress)

O site foi feito com classes do WooCommerce (`.products`, `.product`, `.woocommerce-loop-product__title`, `.price`, `.add_to_cart_button`) pra que a migração seja **troca de template**, não reescrita:

| MVP atual | Tema WordPress |
|---|---|
| `data/produtos.js` | CPT `product` alimentado pelo plugin Tiny ↔ WooCommerce |
| `data/marcas.js` | Taxonomia `product_brand` |
| `assets/css/tokens.css` | `theme.json` (color, typography, spacing) |
| `scripts/enrich-produtos.js` | Plugin oficial Tiny (sync bidirecional automático) |
| Card `VM.cardHTML()` | `content-product.php` |
| `produto.html` + `VM.initPDP()` | `single-product.php` |

Na fase 2, os scripts deste repo aposentam. O Olist continua como fonte única, mas o sync é feito pelo plugin, incluindo o caminho de volta (pedido → Olist).

---

## Troubleshooting

| Erro | Solução |
|---|---|
| `TINY_CLIENT_ID e TINY_CLIENT_SECRET obrigatórios` | Preencher `.env` (Passo 2) |
| Browser abre mas mostra "invalid_redirect_uri" | URL no painel Olist ≠ `TINY_REDIRECT_URI` no `.env` |
| `HTTP 401 — token expirado` | `npm run get-token:refresh` (ou `get-token` se >24h) |
| `HTTP 403 — permissão faltando` | Marcar a permissão no aplicativo Olist e refazer `get-token` |
| `HTTP 429 rate limit` | Script aguarda automaticamente. Se persistir, plano Olist tem limite baixo |
| `EADDRINUSE :::3000` | Outro processo na porta 3000. `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force` |
| Categorias com nome estranho | Editar regras em `scripts/regras-catalogo.js` + rodar `enrich-produtos:cache` |
| Produto aparece na categoria errada | Mesma coisa (a regra que bateu primeiro venceu — reordene) |
| `ffmpeg não encontrado no PATH` | Instale o ffmpeg. No Windows: `winget install Gyan.FFmpeg` e reabra o terminal |
| Imagem nova não apareceu no site | O script pula saída já atualizada. Rode `npm run otimizar-imagens:force` |

---

## Licença e créditos

Projeto interno VM Click. Marcações de produto seguem convenções WooCommerce para portabilidade.
