/**
 * VM Click - Regras de detecção de sub-categorias
 *
 * Cada regra: { slug, nome, curto, icone, desc, match: /regex/i, parent: 'slug-topo' }
 *
 * O enrich testa o nome de cada produto contra as regras (na ordem).
 * A PRIMEIRA que bater define a sub-categoria.
 * Se nenhuma bater, produto fica na categoria top-level do Olist.
 *
 * "parent" é o slug da top-level Olist a que a sub-cat pertence (só pra organização).
 */

module.exports = [
  // ------------------- ELÉTRICA -------------------
  { slug: 'disjuntores', nome: 'Disjuntores e DR', curto: 'Disjuntores', icone: 'p-disjuntor', parent: 'eletrica',
    match: /disjuntor|idr|interruptor.diferencial|dps|protetor.de.surto/i,
    desc: 'Disjuntores, IDR, DPS e dispositivos de proteção elétrica.' },

  { slug: 'cabos-fios', nome: 'Cabos e Fios', curto: 'Cabos', icone: 'p-cabo', parent: 'eletrica',
    match: /\bcabo\b|\bfio\b|cordao|flex[ií]vel.*mm|pp\s*\d|paralelo|rede.*cat|utp|coaxial|multipolar/i,
    desc: 'Cabos elétricos, fios, cordões e cabos de dados.' },

  { slug: 'tomadas-interruptores', nome: 'Tomadas e Interruptores', curto: 'Tomadas', icone: 'p-tomada', parent: 'eletrica',
    match: /\btomada\b|interruptor|espelho.*eletric|placa.*4x2|conjunto.*eletric/i,
    desc: 'Tomadas, interruptores, espelhos e conjuntos elétricos.' },

  { slug: 'quadros-eletricos', nome: 'Quadros e Caixas Elétricas', curto: 'Quadros', icone: 'p-projeto', parent: 'eletrica',
    match: /quadro.*distrib|caixa.*disjuntor|centro.*carga|barramento|trilho.*din|caixa.*passagem/i,
    desc: 'Quadros de distribuição, caixas de passagem, barramentos.' },

  { slug: 'iluminacao-led', nome: 'Iluminação LED', curto: 'LED', icone: 'p-lampada', parent: 'eletrica',
    match: /\bled\b|l[aâ]mpada|lumin[aá]ria|refletor|plafon|arandela|spot|painel.*led|fita.*led|bulbo/i,
    desc: 'Lâmpadas LED, luminárias, painéis, refletores e fitas.' },

  { slug: 'automacao-dados', nome: 'Rede e Dados', curto: 'Rede', icone: 'p-cabo', parent: 'eletrica',
    match: /\brj\s*45|patch.*panel|switch\b|rack\b|keystone|rede.*cat.?[56]|telefonia|hdmi|coaxial/i,
    desc: 'Cabeamento estruturado, patch panels, conectores de rede.' },

  { slug: 'motores-bombas', nome: 'Motores e Bombas', curto: 'Motores', icone: 'p-registro', parent: 'eletrica',
    match: /\bmotor\b|bomba.*d.?agua|bomba.*centrif|pressurizador|compressor/i,
    desc: 'Motores elétricos, bombas d\'água e compressores.' },

  // ------------------- FERRAMENTAS -------------------
  { slug: 'ferramentas-eletricas', nome: 'Ferramentas Elétricas', curto: 'F. Elétricas', icone: 'p-alicate', parent: 'ferramentas',
    match: /furadeira|parafusadeira|serra.*(circular|marmore|tico|sabre)|esmerilhadeira|lixadeira|plaina|makita|dewalt|bosch.*prof|rotomartelo/i,
    desc: 'Furadeiras, parafusadeiras, serras e ferramentas motorizadas.' },

  { slug: 'ferramentas-manuais', nome: 'Ferramentas Manuais', curto: 'F. Manuais', icone: 'p-alicate', parent: 'ferramentas',
    match: /alicate|chave.*(fenda|philips|allen|combinada|inglesa|estrela)|martelo|serrote|arco.*serra|torqu[ií]metro|maceta|marreta/i,
    desc: 'Alicates, chaves, martelos e ferramentas manuais.' },

  { slug: 'medicao', nome: 'Medição e Testes', curto: 'Medição', icone: 'p-projeto', parent: 'ferramentas',
    match: /mult[ií]metro|alicate.*amper|trena|n[ií]vel.*(laser|bolha)|paqu[ií]metro|megohm|term[oô]metro|detector.*tens/i,
    desc: 'Multímetros, trenas, níveis, detectores e instrumentos.' },

  { slug: 'epi', nome: 'Segurança e EPI', curto: 'EPI', icone: 'p-projeto', parent: 'ferramentas',
    match: /\bepi\b|luva.*(pvc|latex|isolante|nitr)|capacete|\boculos.*(prote|segur)|prote[çc][aã]o.*auricular|m[aá]scara.*(pff|prote)|cinto.*seguran/i,
    desc: 'EPIs: luvas, capacetes, óculos, máscaras, cintos.' },

  { slug: 'acessorios-ferramentas', nome: 'Acessórios de Ferramentas', curto: 'Acessórios', icone: 'p-alicate', parent: 'ferramentas',
    match: /broca|disco.*(corte|desbaste|serra|diamant)|bit\b|lixa\b|escova.*(a[çc]o|nylon)|serra.*copo|fresa/i,
    desc: 'Brocas, discos, bits, lixas e acessórios para ferramentas.' },

  // ------------------- UTILIDADES -------------------
  { slug: 'limpeza', nome: 'Produtos de Limpeza', curto: 'Limpeza', icone: 'p-caixa', parent: 'utilidades',
    match: /sab[aã]o|detergente|desinfetante|desengord|removedor|limpador|multiuso|amac[ií]ante|cloro|\balvejante|\bveja\b|desengraxante/i,
    desc: 'Sabões, detergentes, desinfetantes e limpadores.' },

  { slug: 'vedacao-adesivos', nome: 'Vedação e Adesivos', curto: 'Vedação', icone: 'p-registro', parent: 'utilidades',
    match: /veda.?rosca|fita.*(iso|crepe|dupla.*face|veda|adesiva)|silicone|cola\b|adesivo|epoxi|massa.*(plast|calafet)/i,
    desc: 'Fitas, silicones, colas, adesivos e massas de vedação.' },

  { slug: 'ferragens', nome: 'Ferragens e Fixação', curto: 'Ferragens', icone: 'p-alicate', parent: 'utilidades',
    match: /parafuso|prego|bucha|arruela|porca\b|abra[çc]adeira|dobradi[çc]a|fecho|cadeado|corrente\b|cantoneira/i,
    desc: 'Parafusos, buchas, abraçadeiras, dobradiças e ferragens.' },

  // ------------------- VESTUÁRIOS (sem sub-categorias específicas) -------------------
  // Fica só na top-level
];
