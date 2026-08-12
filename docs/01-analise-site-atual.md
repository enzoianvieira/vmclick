# VM Click - Análise do site atual (vmclick.com.br)

Data da coleta: 2026-08-12

## 1. Stack atual

| Item | Valor |
|---|---|
| CMS | WordPress |
| Tema | `reobiz` (KeenIT Solutions) - tema comercial genérico "business/corporate" |
| Page builder | Elementor (`elementor-kit-12`) |
| Slider | Slider Revolution (RevSlider) |
| Formulário | Contact Form 7 (`wpcf7-f2078`) |
| Cache/otimização | LiteSpeed Cache |
| Extras | RS Elements Pro, Redux Framework 4.4.18, DataTables 1.10.20 |
| Estrutura | **One-page** - tudo em `/` com âncoras `#produtos`, `#quem-somos`, `#contato` |
| CPTs registrados | `teams`, `portfolios`, `testimonials`, `rselements_pro` (herdados do tema, sem uso real) |

### Problemas identificados
1. **Sem e-commerce** - nenhum WooCommerce, nenhum catálogo navegável. "Produtos" é só um bloco de 6 ícones.
2. **Sem páginas internas** - one-page trava SEO. Zero páginas de categoria, zero PDP, zero landing por segmento.
3. **Lixo de tema demo** - o topbar exibe `(+880)155-69569` e `support@rstheme.com` (dados do demo do tema, não do cliente). Backgrounds ainda apontam para `keenitsolutions.com/products/wordpress/reobiz/...`.
4. **Sem H1** - a home não tem `<h1>`. Só dois `<h2>`.
5. Peso alto: 20+ arquivos CSS concatenados, RevSlider, 3 famílias de fonte (Poppins + Roboto + Roboto Slab).
6. Imagens dos pictogramas em PNG ~823×902px sem otimização/WebP.
7. Sem trust signals (avaliações, marcas parceiras, garantias, formas de pagamento).
8. Sem política de privacidade / LGPD, trocas, entrega.

## 2. Identidade da marca

### Logo
- Horizontal: `LOGO-VMCLICK-2022.png` - símbolo "M/W" em zigue-zague (raio elétrico) sobre quadrado vermelho arredondado + wordmark "VM CLICK" em verde-petróleo + assinatura preta "MATERIAIS ELÉTRICOS, HIDRÁULICOS E UTILIDADES".
- Vertical: `LOGO-VMCLICK-vert-2022.png`.
- Formato atual: PNG raster. **Recomendação: refazer em SVG.**

### Cores extraídas (amostragem de pixel do logo + CSS computado)

| Cor | Hex | Origem | Uso atual |
|---|---|---|---|
| Vermelho VM | `#E63337` | Logo (símbolo) | Símbolo da marca |
| Verde-petróleo VM | `#076E65` | Logo (wordmark) + topbar do site | Barra superior, ícones |
| Preto | `#000000` | Logo (assinatura) | Texto |
| Vermelho botão | `#D83030` | CSS do tema | Botão "Solicitar Orçamento" |
| Azul-marinho | `#032E42` | CSS do tema | Cor de títulos H2 |
| Azul link | `#1273EB` | CSS do tema (resíduo do demo) | Links - **fora da identidade** |
| Cinza rodapé | `#7C7C7C` | CSS do tema | Fundo do rodapé |
| Cinza texto | `#363636` / `#333333` | CSS do tema | Corpo de texto |

> As três cores da marca são **#E63337, #076E65 e #000000**. Azul (`#032E42`, `#1273EB`) e cinza (`#7C7C7C`) são resíduos do tema, não identidade.

### Tipografia atual
- Poppins (500/600/700) - títulos e destaques
- Roboto (400/500/600) - corpo
- Roboto Slab (400) - resíduo do tema

## 3. Conteúdo aproveitável (verbatim)

### Título/SEO
> VM Click | Materiais Elétricos e Hidráulicos em Curitiba

### Hero (slider atual)
> **Lâmpadas de LED**
> Projetos de iluminação e instalação. Materiais elétricos, hidráulicos e utilidades. Envie agora seu orçamento ou sua solicitação.
> CTA: **Solicitar Orçamento**

### Bloco "Produtos e Serviços"
Subtítulo: *conheça nossa linha de produtos e serviços*

| # | Categoria | Texto atual |
|---|---|---|
| 1 | **Materiais elétricos** | Ampla variedade em materiais de alta e baixa tensão, para estrutura e acabamento, produtos de alta qualidade, visando segurança e eficiência. |
| 2 | **Iluminação** | Luminárias, lâmpadas de led e acessórios para iluminação residencial e comercial. Lâmpadas com alto fator de luminosidade e certificadas. |
| 3 | **Materiais hidráulicos** | Tubos e conexões para água e esgoto. Temos uma grande variedade de produtos para pequenos reparos e grandes instalações. |
| 4 | **Utilidades** | Ferramentas manuais para eletricistas, encanadores, jardineiros e outros profissionais. Produtos para manutenção e limpeza da casa e jardim. |
| 5 | **Pintura e construção** | Temos massas, tintas, EPIs e muito mais. Produtos para a construção civil e todas as demandas da sua obra, reforma ou manutenção. |
| 6 | **Projetos e serviços** | Setor de design responsável pela criação de projetos de lighting design e consultorias para iluminação. Equipe parceira para instalação elétrica e hidráulica. |

Pictogramas existentes (reaproveitáveis, converter para SVG):
`ELETRICA-PICTOGRAMA.png`, `ILUMINACAO-PICTOGRAMA.png`, `HIDRAULICA-PICTOGRAMA.png`, `UTILIDADES-PICTOGRAMA-1.png`, `PINTURA-E-REFORMAS-PICTOGRAMA.png`, `SERVICOS-PICTOGRAMA-1.png`

### Quem Somos (verbatim - reaproveitar)
> Em 2012 a VM CLICK entrou no mercado de materiais elétricos para oferecer soluções efetivas com produtos de qualidade e ótimo atendimento para o público. Desde então vem ganhando espaço e escrevendo sua história junto das experiências de seus clientes.
>
> Os três primeiros anos foram dedicados ao televendas e a parte elétrica, mas com a ampliação da loja outras linhas ganharam espaço e hoje a empresa atende diversos segmentos com a variedade de mais de 30.000 itens.
>
> Entre os pilares que formam a empresa ter profissionais competentes que amam o que fazem é primordial, ponto que coloca a VM CLICK em destaque por seu atendimento técnico e acolhedor. Sua equipe multidisciplinar também contribui para que a empresa seja reconhecida por solucionar problemas, sanar dúvidas, fornecer o melhor produto e realizar projetos inovadores.

### Depoimento do fundador (verbatim)
> "Nossa realização é estarmos presentes nas obras, em frente aos clientes na loja, cuidando das especificações, informando os detalhes de instalação, fornecendo os melhores produtos. Sabemos da qualidade que nos propomos a entregar, garantimos isso. É uma honra fazer parte das realizações de cada cliente que confia em nosso trabalho."
> - **Maurício Veiga**, fundador

### Números da marca (usáveis como prova social)
- **2012** - ano de fundação (13+ anos de mercado)
- **+30.000** itens em catálogo
- **6** linhas de produtos/serviços
- Curitiba/PR - loja física + televendas

## 4. Dados de contato (canônicos)

| Campo | Valor |
|---|---|
| E-mail | contato@vmclick.com.br |
| Telefone fixo | (41) 3089-2453 |
| Celular/WhatsApp | (41) 99892-0006 |
| Link WhatsApp | `https://api.whatsapp.com/send?phone=5541998920006&text=Vim%20do%20site%20e%20gostaria%20de%20um%20or%C3%A7amento` |
| Endereço | R. Amadeu do Amaral, 1602 - Portão, Curitiba/PR |
| Horário | 09:00 – 18:00 |
| Facebook | https://pt-br.facebook.com/vmclick/ |
| Instagram | https://www.instagram.com/vmclick |

> ⚠️ Remover do novo site: `(+880)155-69569` e `support@rstheme.com` (dados falsos do demo do tema).

## 5. Formulário de contato atual
Campos: `your-name`, `your-email`, `your-phone`, `your-message` - manter no novo site (compatível com CF7 ou substituto).

## 6. O que o site novo precisa resolver

| Prioridade | Item |
|---|---|
| P0 | Aba **Produtos** = vitrine navegável (categoria → listagem → PDP → carrinho) |
| P0 | Estrutura multi-página com URLs reais (SEO local Curitiba) |
| P0 | Compatível com WordPress + WooCommerce (base para o plugin Olist) |
| P0 | Limpar dados do tema demo |
| P1 | Design atualizado, mobile-first, performance |
| P1 | Trust signals, prova social, LGPD |
| P2 | Blog/conteúdo técnico (SEO de cauda longa: "como dimensionar disjuntor", etc.) |

