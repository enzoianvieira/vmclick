/* ==========================================================================
   VM Click - índice do blog  (ARQUIVO EDITÁVEL À MÃO)
   --------------------------------------------------------------------------
   Fonte única do índice: alimenta a listagem em blog.html e o bloco
   "leia também" no rodapé de cada post. O conteúdo do artigo mora no HTML
   da própria página — aqui ficam só os metadados.

   Para publicar um post novo:
     1. duplique um dos arquivos blog-*.html e escreva o conteúdo
     2. adicione a entrada abaixo, no topo da lista (ordem = mais recente antes)
     3. `data` no formato ISO (AAAA-MM-DD); é o que ordena e o que vira <time>

   Na fase WordPress esta lista vira o loop de `post` e some daqui.
   ========================================================================== */

window.VM_POSTS = [
  {
    slug: 'blog-dimensionar-disjuntor-cabo.html',
    titulo: 'Como dimensionar disjuntor e cabo sem errar o circuito',
    resumo: 'A conta que evita cabo aquecendo e disjuntor desarmando à toa: corrente de projeto, seção do condutor, curva do disjuntor e a ordem certa de decidir cada um.',
    categoria: 'Elétrica',
    data: '2026-08-06',
    leitura: '8 min',
    capa: { peq: 'assets/img/loja/painel-900', grd: 'assets/img/loja/painel-1600' },
    alt: 'Quadro de distribuição com disjuntores DIN alinhados no trilho',
  },
  {
    slug: 'blog-temperatura-cor-led.html',
    titulo: 'Temperatura de cor, lúmen e IRC: escolhendo LED por ambiente',
    resumo: 'Watt não é mais medida de luz. O que olhar na embalagem para a sala não virar consultório — e por que o mesmo 4000K funciona na cozinha e destrói o quarto.',
    categoria: 'Iluminação',
    data: '2026-07-24',
    leitura: '6 min',
    capa: { peq: 'assets/img/banners/promo-iluminacao-800', grd: 'assets/img/banners/promo-iluminacao-1920' },
    alt: 'Lâmpadas e luminárias LED expostas na loja',
  },
  {
    slug: 'blog-checklist-eletrica-obra.html',
    titulo: 'Checklist do material elétrico: da fundação à entrega da obra',
    resumo: 'O que comprar em cada fase da obra, o que dá para deixar por último e os itens que sempre faltam na sexta-feira à tarde. Lista pronta para levar ao balcão.',
    categoria: 'Obra',
    data: '2026-07-10',
    leitura: '7 min',
    capa: { peq: 'assets/img/loja/interior-900', grd: 'assets/img/loja/interior-1600' },
    alt: 'Corredor da loja VM Click com prateleiras de material elétrico e ferragens',
  },
];
