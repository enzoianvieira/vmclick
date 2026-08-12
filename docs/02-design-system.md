# VM Click - Design System v1

Base do redesign + e-commerce (MVP). Todos os tokens vivem em `design-system/tokens.css` como CSS custom properties, para poderem ser espelhados em `theme.json` do WordPress e nas configurações globais do WooCommerce.

---

## 1. Princípios

1. **Loja técnica, não bazar.** Público mistura profissional (eletricista, encanador, construtor) e consumidor final. Interface limpa, informação técnica visível (potência, bitola, tensão, código), zero poluição visual.
2. **Verde = marca, vermelho = ação.** Verde-petróleo sustenta a identidade institucional; vermelho é reservado a conversão (comprar, orçamento, promoção). Nunca usar vermelho como cor de fundo de seção grande.
3. **Mobile-first.** A maior parte do tráfego de material de construção em Curitiba vem do celular, direto do WhatsApp.
4. **Estrutura WooCommerce-compatível.** Toda a nomenclatura de componente espelha classes/slots do WooCommerce para que a migração ao WordPress + plugin Olist não exija reescrita.
5. **Densidade útil.** Catálogo de +30.000 itens exige busca forte, filtros e breadcrumbs, não carrossel decorativo.

---

## 2. Cor

### 2.1 Cores da marca (fixas - extraídas do logo)

| Token | Hex | Uso |
|---|---|---|
| `--vm-red` | `#E63337` | Símbolo, CTA primário, promoções |
| `--vm-teal` | `#076E65` | Cor institucional, header, links, ícones |
| `--vm-black` | `#111111` | Texto principal (preto puro só no logo) |

### 2.2 Rampa Teal (primária / institucional)

| Token | Hex |
|---|---|
| `--teal-50` | `#F0FAF8` |
| `--teal-100` | `#DCF3EF` |
| `--teal-200` | `#B4E6DE` |
| `--teal-300` | `#7FD3C7` |
| `--teal-400` | `#41B6A7` |
| `--teal-500` | `#149A8B` |
| `--teal-600` | `#0A8377` |
| **`--teal-700`** | **`#076E65`** ← marca |
| `--teal-800` | `#065950` |
| `--teal-900` | `#04403A` |
| `--teal-950` | `#022825` |

### 2.3 Rampa Red (ação / conversão)

| Token | Hex |
|---|---|
| `--red-50` | `#FEF3F3` |
| `--red-100` | `#FDE4E4` |
| `--red-200` | `#FBCCCD` |
| `--red-300` | `#F7A5A7` |
| `--red-400` | `#F17376` |
| `--red-500` | `#EA4A4E` |
| **`--red-600`** | **`#E63337`** ← marca |
| `--red-700` | `#C21F23` |
| `--red-800` | `#9E1C1F` |
| `--red-900` | `#7C1A1D` |

### 2.4 Rampa Neutra

| Token | Hex | Uso |
|---|---|---|
| `--n-0` | `#FFFFFF` | Fundo de card, superfície |
| `--n-50` | `#F7F9F9` | Fundo de página alternado |
| `--n-100` | `#EFF2F2` | Fundo de seção, skeleton |
| `--n-200` | `#E1E6E6` | Bordas, divisores |
| `--n-300` | `#C6CFCF` | Borda de input |
| `--n-400` | `#9AA5A5` | Placeholder, ícone inativo |
| `--n-500` | `#71807F` | Texto terciário |
| `--n-600` | `#54615F` | Texto secundário |
| `--n-700` | `#3A4645` | Texto de corpo forte |
| `--n-800` | `#242E2D` | Títulos |
| `--n-900` | `#141B1A` | Texto máximo |
| `--n-950` | `#0A0F0F` | Fundo do rodapé |

### 2.5 Semânticas

| Token | Hex | Uso |
|---|---|---|
| `--success` | `#127A3E` | Em estoque, pedido confirmado |
| `--success-bg` | `#E8F5EE` | |
| `--warning` | `#B4690E` | Últimas unidades, atenção |
| `--warning-bg` | `#FDF3E4` | |
| `--danger` | `#B3261E` | Erro, esgotado, remover |
| `--danger-bg` | `#FCEDEC` | |
| `--info` | `#0B5E8A` | Aviso neutro, prazo de entrega |
| `--info-bg` | `#E7F2F8` | |
| `--promo` | `#E63337` | Badge de desconto (usa a marca) |
| `--whatsapp` | `#25D366` | Botão/FAB do WhatsApp |

> **Regra:** `--danger` (#B3261E) é **diferente** do vermelho da marca (#E63337) - erro não pode ser confundido com CTA.

### 2.6 Contraste (WCAG AA)

| Combinação | Ratio | Status |
|---|---|---|
| `--teal-700` sobre branco | 5.6:1 | ✅ AA texto normal |
| branco sobre `--teal-700` | 5.6:1 | ✅ AA |
| `--red-600` sobre branco | 4.0:1 | ⚠️ só em texto ≥18.66px bold ou ícone/borda |
| branco sobre `--red-600` | 4.0:1 | ⚠️ botão: usar `--red-700` (#C21F23 → 6.0:1) para texto pequeno |
| `--n-700` sobre branco | 9.6:1 | ✅ AAA |
| `--n-600` sobre `--n-50` | 6.8:1 | ✅ AA |

**Decisão:** botões vermelhos usam fundo `--red-600` com texto branco **≥16px semibold**; estados `:hover` e `:focus` descem para `--red-700`.

---

## 3. Tipografia

### 3.1 Famílias

| Papel | Família | Pesos | Motivo |
|---|---|---|---|
| Títulos / display | **Poppins** | 600, 700 | Já usada pela marca, geométrica, casa com o "M" do logo |
| Corpo / UI / dados | **Inter** | 400, 500, 600, 700 | Alta legibilidade em tabelas técnicas e specs; números tabulares |
| Mono (código/SKU) | `ui-monospace, "JetBrains Mono", monospace` | 400 | Código de produto, EAN |

Stacks:
```css
--font-display: "Poppins", "Segoe UI", system-ui, sans-serif;
--font-body: "Inter", "Segoe UI", Roboto, system-ui, sans-serif;
--font-mono: ui-monospace, "JetBrains Mono", "SFMono-Regular", monospace;
```
> Roboto Slab é **removida** (resíduo do tema antigo). Roboto vira só fallback.

### 3.2 Escala (base 16px, razão 1.25)

| Token | Desktop | Mobile | Line-height | Peso | Uso |
|---|---|---|---|---|---|
| `--fs-display` | 56px / 3.5rem | 36px | 1.08 | 700 | Hero |
| `--fs-h1` | 44px | 32px | 1.15 | 700 | Título de página |
| `--fs-h2` | 34px | 26px | 1.2 | 700 | Seção |
| `--fs-h3` | 26px | 22px | 1.25 | 600 | Bloco / nome de produto na PDP |
| `--fs-h4` | 20px | 18px | 1.3 | 600 | Card, subseção |
| `--fs-lg` | 18px | 17px | 1.6 | 400 | Lead / intro |
| `--fs-base` | 16px | 16px | 1.6 | 400 | Corpo |
| `--fs-sm` | 14px | 14px | 1.55 | 400 | Meta, specs, breadcrumb |
| `--fs-xs` | 12px | 12px | 1.45 | 500 | Badge, label, caption |
| `--fs-price` | 28px | 24px | 1.1 | 700 | Preço na PDP (`font-variant-numeric: tabular-nums`) |

Letter-spacing: títulos `-0.02em`; `--fs-xs` em caixa alta `+0.06em`.
Largura de leitura: máx. **68ch** em blocos de texto corrido.

---

## 4. Espaçamento, grid e raios

### 4.1 Escala de espaço (base 4px)
`--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 · `--sp-8` 32 · `--sp-10` 40 · `--sp-12` 48 · `--sp-16` 64 · `--sp-20` 80 · `--sp-24` 96 · `--sp-32` 128

Padding vertical de seção: mobile `--sp-16` (64), desktop `--sp-24` (96).

### 4.2 Breakpoints

| Nome | Largura | Colunas de produto |
|---|---|---|
| `xs` | < 480px | 2 |
| `sm` | ≥ 480px | 2 |
| `md` | ≥ 768px | 3 |
| `lg` | ≥ 1024px | 4 (com sidebar de filtro: 3) |
| `xl` | ≥ 1280px | 4 |
| `2xl` | ≥ 1440px | 5 (opcional) |

### 4.3 Container
`--container-max: 1280px`; gutter mobile 16px, tablet 24px, desktop 32px. Grid de 12 colunas, gap 24px.

### 4.4 Raios
`--r-sm` 4px · `--r-md` 8px · `--r-lg` 12px · `--r-xl` 16px · `--r-2xl` 24px · `--r-pill` 999px
Padrão: card 12px, botão 8px, input 8px, badge pill, imagem de produto 12px.

### 4.5 Sombras (tinta neutra fria, nunca preto puro)
```
--sh-xs: 0 1px 2px rgba(10,15,15,.06)
--sh-sm: 0 2px 6px rgba(10,15,15,.07)
--sh-md: 0 6px 16px rgba(10,15,15,.09)
--sh-lg: 0 14px 32px rgba(10,15,15,.12)
--sh-focus: 0 0 0 3px rgba(7,110,101,.32)
```

### 4.6 Movimento
`--dur-fast` 120ms · `--dur` 200ms · `--dur-slow` 320ms · `--ease` cubic-bezier(.2,.7,.3,1)
Respeitar `prefers-reduced-motion`. Sem parallax, sem carrossel autoplay agressivo (o RevSlider sai).

---

## 5. Componentes

### 5.1 Botões

| Variante | Fundo | Texto | Uso |
|---|---|---|---|
| **Primary** | `--red-600` → hover `--red-700` | branco | Comprar, Adicionar ao carrinho, Finalizar |
| **Secondary** | `--teal-700` → hover `--teal-800` | branco | Ver produtos, Enviar formulário |
| **Outline** | transparente, borda `--teal-700` | `--teal-700` | Ação secundária na PDP |
| **Ghost** | transparente | `--n-700` | Ações terciárias, filtros |
| **WhatsApp** | `--whatsapp` | branco | Orçamento / falar com vendedor |
| **Danger** | `--danger` | branco | Remover item |

Tamanhos: `sm` 36px altura / 12-16px pad · `md` 44px / 16-24px · `lg` 52px / 20-32px.
Estados obrigatórios: default, hover, active, focus-visible (`--sh-focus`), disabled (`--n-200`/`--n-400`), loading (spinner + largura travada).
Alvo de toque mínimo 44×44px.

### 5.2 Header (2 camadas)
1. **Main bar** (branco, sticky ao rolar, 80px→64px): logo · **busca central com autocomplete** (essencial p/ 30k SKUs) · **carrinho com contador**.
2. **Nav** (branco, borda inferior `--n-200`): Início · **Produtos** (mega-menu com as categorias) · Serviços · Quem Somos · Contato · telefone do atendimento técnico à direita.

> Sem topbar e sem faixa de demonstração no topo (decisão do cliente, ago/2026). Contato completo vive no rodapé e na página de Contato; o aviso de ambiente de teste aparece no rodapé, na página de produto, no carrinho e no checkout - onde de fato importa.

Mobile: logo + busca (ícone que expande) + carrinho + hambúrguer → drawer lateral.

### 5.3 Card de produto (`.vm-product-card`)
Slots, na ordem: badge (promo/novo/últimas) → imagem 1:1 (fundo `--n-50`) → categoria (`--fs-xs`, `--n-500`) → nome (2 linhas, clamp) → código/SKU mono `--fs-xs` → preço (`de` riscado + `por`) → parcelamento → botão "Adicionar" (primary, full width) + botão ícone favoritar.
Hover: `--sh-md` + leve translateY(-2px). Skeleton definido para carregamento.
Estado esgotado: imagem 45% opacidade + badge `--danger-bg` + botão vira "Avise-me".

### 5.4 Página de listagem (PLP)
Breadcrumb · H1 da categoria · contador de resultados · ordenação (relevância, menor preço, maior preço, mais vendidos) · sidebar de filtros (categoria, marca, faixa de preço, tensão/bitola/potência quando aplicável, disponibilidade) · grid responsivo · paginação numerada (não infinite scroll - melhor p/ SEO).
Mobile: filtros em bottom-sheet.

### 5.5 Página de produto (PDP)
Galeria (thumb vertical + zoom) · nome · SKU/EAN · avaliação (placeholder) · preço + parcelamento + "à vista no PIX" · seletor de variação · stepper de quantidade · **Adicionar ao carrinho** (primary) + **Comprar agora** (secondary) · **simulador de frete por CEP** (mock no MVP) · abas: Descrição · Especificações técnicas (tabela) · Entrega e devolução · faixa de confiança · **produtos relacionados**.

### 5.6 Carrinho e checkout (MVP = mock)
Drawer lateral ao adicionar · página de carrinho com tabela + cupom + resumo sticky · checkout em 3 passos (Identificação → Entrega → Pagamento) apenas visual, com métodos PIX/Boleto/Cartão desenhados mas **sem processamento real**. Tela final "Pedido simulado" deixa explícito que é ambiente de demonstração.

### 5.7 Demais componentes
Breadcrumb · Badge/tag · Input, select, textarea, checkbox, radio, stepper de quantidade · Tabela de especificações (zebra `--n-50`) · Accordion (FAQ) · Tabs · Toast/alert (4 semânticas) · Paginação · Empty state · Skeleton · Modal/drawer · Card de categoria (com pictograma) · Faixa de confiança (entrega, atendimento técnico, 13 anos, +30.000 itens) · Card de depoimento · Rodapé 4 colunas (institucional · categorias · atendimento · newsletter + selos de pagamento) · **FAB de WhatsApp** fixo no canto inferior direito.

---

## 6. Mapeamento para WordPress

| Token / componente | Destino no WP |
|---|---|
| Paleta | `theme.json → settings.color.palette` (slugs `vm-red`, `vm-teal`, `vm-black`, `n-50`…`n-950`) |
| Tipografia | `theme.json → settings.typography.fontFamilies` + `fontSizes` (fontes auto-hospedadas, sem Google Fonts externo - LGPD/performance) |
| Espaçamento | `settings.spacing.spacingSizes` |
| Container | `settings.layout.contentSize: 1280px`, `wideSize: 1440px` |
| Card de produto | template part / override de `content-product.php` |
| PLP | `archive-product.php` |
| PDP | `single-product.php` |
| Carrinho/checkout | blocos WooCommerce Cart/Checkout |
| Categorias | taxonomia `product_cat` (6 categorias raiz do site atual) |
| Produtos | CPT `product` (WooCommerce) - o plugin Olist sincroniza SKU, preço e estoque nesse CPT |
| Formulário de contato | mantém campos `your-name`, `your-email`, `your-phone`, `your-message` |

**Regra de ouro do MVP:** todo HTML da vitrine usa as classes e a hierarquia do WooCommerce (`.products`, `.product`, `.woocommerce-loop-product__title`, `.price`, `.add_to_cart_button`) para que a migração seja troca de template, não reescrita.

---

## 7. Acessibilidade (mínimo obrigatório)
- Contraste AA em todo texto; foco visível em todo elemento interativo.
- Navegação completa por teclado (drawer e modal com focus trap + `Esc`).
- `alt` descritivo em todo produto; ícones decorativos com `aria-hidden`.
- Landmarks semânticos (`header`, `nav`, `main`, `footer`), um único `h1` por página.
- Labels reais em formulários (nunca só placeholder); erros com texto + ícone, nunca só cor.
- `prefers-reduced-motion` respeitado.

---

## 8. Fora do escopo do MVP (documentado para a fase 2)
Pagamento real, cálculo de frete real (Correios/transportadora), login/área do cliente, sincronismo real Olist ↔ estoque, cupom funcional, avaliações de produto, blog, multi-idioma, dark mode.

