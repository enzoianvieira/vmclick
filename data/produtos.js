/* ==========================================================================
   VM Click - catálogo do site
   --------------------------------------------------------------------------
   VITRINE ESVAZIADA EM 2026-08-25 a pedido do cliente.
   Os 2401 produtos anteriores foram removidos SOMENTE do site.
   Nada foi excluído no Olist: os scripts deste projeto só fazem GET.

   Para restaurar o catálogo anterior:
     git show HEAD:data/produtos.js > data/produtos.js

   Para popular com a lista curada de SKUs:
     npm run get-token          (autoriza no navegador)
     npm run enrich-produtos    (usa scripts/skus-site.txt)
   ========================================================================== */

window.VM_CATEGORIAS = [
  {
    slug: "eletrica",
    nome: "Elétrica",
    curto: "Elétrica",
    icone: "p-disjuntor",
    desc: "Produtos da categoria Elétrica disponíveis em estoque."
  },
  {
    slug: "disjuntores",
    nome: "Disjuntores e DR",
    curto: "Disjuntores",
    icone: "p-disjuntor",
    desc: "Disjuntores, IDR, DPS e dispositivos de proteção elétrica."
  },
  {
    slug: "cabos-fios",
    nome: "Cabos e Fios",
    curto: "Cabos",
    icone: "p-cabo",
    desc: "Cabos elétricos, fios, cordões e cabos de dados."
  },
  {
    slug: "tomadas-interruptores",
    nome: "Tomadas e Interruptores",
    curto: "Tomadas",
    icone: "p-tomada",
    desc: "Tomadas, interruptores, espelhos e conjuntos elétricos."
  },
  {
    slug: "quadros-eletricos",
    nome: "Quadros e Caixas Elétricas",
    curto: "Quadros",
    icone: "p-projeto",
    desc: "Quadros de distribuição, caixas de passagem, barramentos."
  },
  {
    slug: "iluminacao-led",
    nome: "Iluminação LED",
    curto: "LED",
    icone: "p-lampada",
    desc: "Lâmpadas LED, luminárias, painéis, refletores e fitas."
  },
  {
    slug: "automacao-dados",
    nome: "Rede e Dados",
    curto: "Rede",
    icone: "p-cabo",
    desc: "Cabeamento estruturado, patch panels, conectores de rede."
  },
  {
    slug: "ferramentas-eletricas",
    nome: "Ferramentas Elétricas",
    curto: "F. Elétricas",
    icone: "p-alicate",
    desc: "Furadeiras, parafusadeiras, serras e ferramentas motorizadas."
  },
  {
    slug: "ferramentas-manuais",
    nome: "Ferramentas Manuais",
    curto: "F. Manuais",
    icone: "p-alicate",
    desc: "Alicates, chaves, martelos e ferramentas manuais."
  },
  {
    slug: "epi",
    nome: "Segurança e EPI",
    curto: "EPI",
    icone: "p-projeto",
    desc: "EPIs: luvas, capacetes, óculos, máscaras, cintos."
  },
  {
    slug: "acessorios-ferramentas",
    nome: "Acessórios de Ferramentas",
    curto: "Acessórios",
    icone: "p-alicate",
    desc: "Brocas, discos, bits, lixas e acessórios para ferramentas."
  },
  {
    slug: "limpeza",
    nome: "Produtos de Limpeza",
    curto: "Limpeza",
    icone: "p-caixa",
    desc: "Sabões, detergentes, desinfetantes e limpadores."
  },
  {
    slug: "vedacao-adesivos",
    nome: "Vedação e Adesivos",
    curto: "Vedação",
    icone: "p-registro",
    desc: "Fitas, silicones, colas, adesivos e massas de vedação."
  },
  {
    slug: "ferragens",
    nome: "Ferragens e Fixação",
    curto: "Ferragens",
    icone: "p-alicate",
    desc: "Parafusos, buchas, abraçadeiras, dobradiças e ferragens."
  }
];

window.VM_PRODUTOS = [];
