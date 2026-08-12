# VM Click - MVP da nova loja

Ambiente de demonstração do redesign do site + vitrine de e-commerce da VM Click.
Nenhuma compra é processada: este é o ambiente que o cliente usa para **ver como será a experiência do cliente final**.

---

## Como abrir

**Modo simples (o que o cliente faz):** duplo clique em `index.html`. Funciona direto do sistema de arquivos, sem servidor, sem instalar nada.

**Modo desenvolvimento (recomendado para editar):**

```bash
npx http-server -p 4321 -c-1 .
```

Depois abra `http://localhost:4321`.

> O projeto foi construído sem `fetch` e sem módulos ES justamente para funcionar em `file://` - por isso o catálogo é `data/produtos.js` (e não `.json`) e o sprite de ícones é injetado por JS.

---

## O que já funciona

| Área | Estado |
|---|---|
| Home com hero 3D (three.js) e animações GSAP | ✅ |
| Vitrine com busca, 4 grupos de filtro, 5 ordenações e paginação | ✅ |
| Página de categoria (5 categorias) | ✅ |
| Página de produto com specs técnicas, abas e simulador de frete | ✅ |
| Carrinho (drawer + página), com persistência em `localStorage` | ✅ |
| Checkout em 3 passos com validação | ✅ visual, sem cobrança |
| Serviços, Quem Somos, Contato, Políticas | ✅ |
| Busca com sugestões no header | ✅ |
| Responsivo (2 colunas no mobile, filtros em bottom-sheet) | ✅ |
| Acessibilidade: foco visível, `Esc`, foco preso em drawer, labels reais | ✅ |
| `prefers-reduced-motion` respeitado | ✅ |

**Fora do MVP (fase 2):** pagamento real, frete real, login, sincronismo com o Olist Tiny, cupons ativos, avaliações reais, blog.

---

## Estrutura

```
vmclick/
├─ index.html · produtos.html · categoria.html · produto.html
├─ carrinho.html · finalizar.html
├─ servicos.html · quem-somos.html · contato.html · politica.html
├─ data/
│  └─ produtos.js          ← catálogo (arquivo único, substituível)
├─ assets/
│  ├─ css/  fonts · tokens · base · components · pages
│  ├─ js/   app · cart · catalog · animations · hero-3d · sprite
│  ├─ fonts/ Poppins + Inter (auto-hospedadas, 156 KB)
│  ├─ img/  logo.svg
│  └─ vendor/ gsap · ScrollTrigger · three
├─ design-system/  tokens.css · preview.html
└─ docs/  análise do site atual · design system · decisões
```

### Arquivos que você vai querer editar primeiro

| Quero mudar… | Edite |
|---|---|
| Produtos, preços, estoque | `data/produtos.js` |
| Telefone, endereço, WhatsApp, horário | `assets/js/app.js` → objeto `EMPRESA` |
| Cores, fontes, espaçamentos | `assets/css/tokens.css` |
| Menu e rodapé | `assets/js/app.js` → `headerHTML()` / `footerHTML()` |
| Textos das páginas | o `.html` correspondente |

---

## Caminho para o WordPress

A marcação da vitrine usa as classes do WooCommerce de propósito (`.products`, `.product`,
`.woocommerce-loop-product__title`, `.price`, `.add_to_cart_button`, `.woocommerce-breadcrumb`).
A migração é **troca de template**, não reescrita:

| Aqui | No tema WordPress |
|---|---|
| `headerHTML()` / `footerHTML()` | `header.php` / `footer.php` |
| `VM.cardHTML()` | `content-product.php` |
| `produtos.html` / `categoria.html` | `archive-product.php` + `product_cat` |
| `produto.html` | `single-product.php` |
| `carrinho.html` / `finalizar.html` | blocos Cart / Checkout do WooCommerce |
| `assets/css/tokens.css` | `theme.json` (`settings.color`, `typography`, `spacing`) |
| `data/produtos.js` | CPT `product`, alimentado pelo **Olist Tiny** |

**Lembrete da fase 2:** o Olist Tiny é ERP, não loja - ele sincroniza produto, preço, estoque e pedido
com o WooCommerce, que continua responsável por vitrine e checkout.

---

## Pontos que precisam de decisão do cliente

1. **Logo em vetor.** O `assets/img/logo.svg` foi redesenhado a partir do PNG do site atual. Se existir o arquivo original (AI/EPS/SVG), substitua - o traço fica melhor.
2. **Fotos.** As imagens de produto são ilustrações técnicas em SVG. As fotos reais entram junto com a integração do Tiny.
3. **CNPJ e políticas.** O rodapé está com CNPJ de exemplo e `politica.html` é um modelo - precisa de revisão jurídica antes de ir ao ar.
4. **Frete e prazos.** Frete grátis acima de R$ 299 e prazo de 1 a 3 dias úteis são valores de demonstração.
5. **Compatibilidade WooCommerce × Tiny.** Confirmar com o suporte Olist a versão suportada antes de fechar a fase 2.

