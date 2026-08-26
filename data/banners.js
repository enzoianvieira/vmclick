/* ==========================================================================
   VM Click - banners do carrossel da home  (EDITÁVEL PELO PAINEL)
   --------------------------------------------------------------------------
   Este arquivo é gerado pelo painel administrativo (admin/) e também pode ser
   editado à mão. Ele NÃO é sobrescrito pelo sync do Olist.

   Campos:
     titulo   rótulo interno, aparece no painel e no aria-label do slide
     link     para onde o banner leva (página do site)
     img      caminho base da imagem, SEM extensão e SEM sufixo de tamanho
              o site monta sozinho: {img}-800.jpg/webp e {img}-1920.jpg/webp
     alt      descrição da imagem para leitor de tela e para quando ela falha
     ativo    false tira do ar sem apagar o cadastro

   Para trocar a arte de um banner, suba os 4 arquivos com o mesmo nome base
   em assets/img/banners/ e rode `npm run otimizar-imagens`.
   ========================================================================== */

window.VM_BANNERS = [
  {
    titulo: 'Promoção em iluminação',
    link: 'categoria.html?cat=iluminacao-led',
    img: 'assets/img/banners/promo-iluminacao',
    alt: 'Promoção em iluminação: lâmpadas e materiais elétricos, LED a partir de R$ 19,90',
    ativo: true,
  },
  {
    titulo: 'Promoção em hidráulica',
    link: 'produtos.html?q=pvc',
    img: 'assets/img/banners/promo-hidraulica',
    alt: 'Promoção em hidráulica: tubos e conexões, conexões PVC a partir de R$ 12,90',
    ativo: true,
  },
  {
    titulo: 'Promoção em ferramentas',
    link: 'categoria.html?cat=ferramentas-manuais',
    img: 'assets/img/banners/promo-ferramentas',
    alt: 'Promoção em ferramentas: chaves e alicates, chave de fenda a partir de R$ 9,90',
    ativo: true,
  },
];
