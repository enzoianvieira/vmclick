/**
 * VM Click - Detecção de marca a partir do nome do produto
 *
 * Por que existe: o Olist devolve `marca` vazia na maior parte do catálogo
 * (o campo não é preenchido no cadastro). O nome do produto, porém, quase
 * sempre carrega a marca ("CABO FLEXIVEL CORFIO 2,5MM 750V PRETO").
 * Estas regras extraem essa informação de forma determinística.
 *
 * Precedência: a marca vinda do Olist SEMPRE vence. Isto aqui é fallback.
 *
 * Regras de escrita:
 *   - `match` sempre com \b nas bordas — evita casar dentro de outra palavra.
 *   - Ordem importa: a primeira regra que casar vence. Marcas com nome
 *     composto ou ambíguo vêm antes das genéricas.
 *   - `n` é o rótulo exibido no site (capitalização oficial da marca).
 *
 * Depois de editar: `npm run derivar-marcas` (segundos, não bate na API).
 */

const MARCAS = [
  // --- Hidráulica / construção ---------------------------------------
  { n: 'Tigre',           match: /\btigre\b/i },
  { n: 'Amanco',          match: /\bamanco\b/i },
  { n: 'Krona',           match: /\bkrona\b/i },
  { n: 'Fortlev',         match: /\bfortlev\b/i },
  { n: 'Deca',            match: /\bdeca\b/i },
  { n: 'Docol',           match: /\bdocol\b/i },
  { n: 'Astra',           match: /\bastra\b/i },
  { n: 'Blukit',          match: /\bblukit\b/i },
  { n: 'Censi',           match: /\bcensi\b/i },
  { n: 'Vedacit',         match: /\bvedacit\b/i },
  { n: 'Sika',            match: /\bsika\b/i },

  // --- Condutores ------------------------------------------------------
  { n: 'Corfio',          match: /\bcorfio\b/i },
  { n: 'Cobrecom',        match: /\bcobrecom\b/i },
  { n: 'Nambei',          match: /\bnambei\b/i },
  { n: 'Induscabos',      match: /\bindus\s?cabos\b/i },
  { n: 'Ficap',           match: /\bficap\b/i },
  { n: 'Condusflex',      match: /\bcondus\s?flex\b/i },
  { n: 'Megatron',        match: /\bmegatron\b/i },
  { n: 'Sil',             match: /\bsil\b/i },

  // --- Proteção, comando e instalação ---------------------------------
  { n: 'Schneider',       match: /\bschneider\b|\beasy\s?9\b|\bacti\s?9\b/i },
  { n: 'WEG',             match: /\bweg\b/i },
  { n: 'Siemens',         match: /\bsiemens\b/i },
  { n: 'Steck',           match: /\bsteck\b/i },
  { n: 'Legrand',         match: /\blegrand\b/i },
  { n: 'Pial',            match: /\bpial\b/i },
  { n: 'Margirius',       match: /\bmargirius\b/i },
  { n: 'Cemar',           match: /\bcemar\b/i },
  { n: 'Mectimer',        match: /\bmectimer\b/i },
  { n: 'Exatron',         match: /\bexatron\b/i },
  { n: 'Enerbras',        match: /\bener\s?bras\b/i },
  { n: 'Hydra',           match: /\bhydra\b/i },
  { n: 'Lorenzetti',      match: /\blorenzetti\b/i },
  { n: 'Fame',            match: /\bfame\b/i },
  { n: 'Wetzel',          match: /\bwetzel\b/i },
  { n: 'Inpol',           match: /\binpol\b/i },
  { n: 'HellermannTyton', match: /\bhellermann\b/i },
  { n: 'Sibratec',        match: /\bsibratec\b/i },
  { n: 'Soprano',         match: /\bsoprano\b/i },
  { n: 'Tramontina',      match: /\btramontina\b/i },

  // --- Iluminação ------------------------------------------------------
  /* "CHAVE PHILIPS VONDER": aqui Philips é o tipo da ponta, não a marca.
     Excluído o contexto de ferramenta, a regra da Vonder assume. */
  { n: 'Philips',         match: /\bphilips\b/i, exceto: /\b(chave|chaves|bit|bits|ponta|pontas|parafuso|broca)\b/i },
  { n: 'Osram',           match: /\bosram\b/i },
  { n: 'Taschibra',       match: /\btaschibra\b/i },
  { n: 'Intral',          match: /\bintral\b/i },
  { n: 'Avant',           match: /\bavant\b/i },
  { n: 'Ourolux',         match: /\bouro\s?lux\b/i },
  { n: 'Elgin',           match: /\belgin\b/i },
  { n: 'Foxlux',          match: /\bfox\s?lux\b/i },
  { n: 'Empalux',         match: /\bempalux\b/i },
  { n: 'Mundilux',        match: /\bmundilux\b/i },
  { n: 'Blumenau',        match: /\bblumenau\b/i },
  { n: 'Stella',          match: /\bstella\b/i },
  { n: 'Decorlux',        match: /\bdecor\s?lux\b/i },
  { n: 'Golden',          match: /\bgolden\b/i },

  // --- Ferramentas e fixação -------------------------------------------
  { n: 'Vonder',          match: /\bvonder\b/i },
  { n: 'Worker',          match: /\bworker\b/i },
  { n: 'Bosch',           match: /\bbosch\b/i },
  { n: 'Makita',          match: /\bmakita\b/i },
  { n: 'DeWalt',          match: /\bde\s?walt\b/i },
  { n: 'Stanley',         match: /\bstanley\b/i },
  { n: 'Irwin',           match: /\birwin\b/i },
  { n: 'Starrett',        match: /\bstarrett\b/i },
  { n: 'Norton',          match: /\bnorton\b/i },
  { n: 'Würth',           match: /\bwurth\b|\bwürth\b/i },
  { n: 'Gedore',          match: /\bgedore\b/i },
  { n: 'Sparta',          match: /\bsparta\b/i },
  { n: 'Belfix',          match: /\bbelfix\b/i },
  { n: 'Brasfort',        match: /\bbrasfort\b/i },
  { n: 'Bemfixa',         match: /\bbem\s?fixa\b/i },
  { n: 'Kala',            match: /\bkala\b/i },
  { n: 'Ajax',            match: /\bajax\b/i },
  { n: 'Collins',         match: /\bcollins\b/i },
  { n: 'Millenium',       match: /\bmillenium\b|\bmillennium\b/i },
  { n: 'MHG',             match: /\bmhg\b/i },
  { n: 'Tekbond',         match: /\btek\s?bond\b/i },
  { n: 'Quimatic',        match: /\bquimatic\b/i },
  /* "3M" colide com medida ("ELETRODUTO PVC 1/2\" 3M" = 3 metros).
     Só vale como marca junto de um produto que a 3M realmente fabrica. */
  { n: '3M',              match: /(?:fita|lixa|adesiv|esponja|espuma|m[áa]scara|respirador|luva|[óo]culos|feltro|refletiv|scotch|vhb)[^\n]*\b3m\b|\b3m\b[^\n]*(?:scotch|vhb|imperial|super\s?33|33\+)/i },
  { n: 'Loctite',         match: /\bloctite\b/i },

  // --- Limpeza e utilidades --------------------------------------------
  { n: 'Girando Sol',     match: /\bgirando\s?sol\b/i },
  { n: 'Ypê',             match: /\byp[eê]\b/i },
  { n: 'Bettanin',        match: /\bbettanin\b/i },
  { n: 'Veja',            match: /\bveja\b/i },
  { n: 'Lukma',           match: /\blukma\b/i },
  { n: 'Superpro',        match: /\bsuper\s?pro\b/i },
];

/**
 * Retorna o nome da marca detectada no texto, ou '' se nenhuma casar.
 * @param {string} nome nome/descrição do produto
 * @returns {string}
 */
function detectarMarca(nome) {
  if (!nome) return '';
  for (const m of MARCAS) {
    if (!m.match.test(nome)) continue;
    if (m.exceto && m.exceto.test(nome)) continue;  /* homônimo: segue procurando */
    return m.n;
  }
  return '';
}

/**
 * Normaliza a grafia de uma marca ja conhecida.
 *
 * O Olist devolve `marca` em caixa alta ("SCHNEIDER"), enquanto a deteccao por
 * nome devolve a grafia oficial ("Schneider"). Sem normalizar, a mesma marca
 * aparece duas vezes no filtro da vitrine, so diferindo pela caixa.
 *
 * Marca desconhecida volta como veio, apenas com espacos aparados: melhor
 * exibir o dado do fornecedor do que engoli-lo.
 *
 * @param {string} marca
 * @returns {string}
 */
function canonizarMarca(marca) {
  const limpo = String(marca || '').trim();
  if (!limpo) return '';
  const alvo = limpo.toLowerCase();
  for (const m of MARCAS) {
    if (m.n.toLowerCase() === alvo) return m.n;
    if (m.match.test(limpo) && (!m.exceto || !m.exceto.test(limpo))) return m.n;
  }
  return limpo;
}

module.exports = MARCAS;
module.exports.MARCAS = MARCAS;
module.exports.detectarMarca = detectarMarca;
module.exports.canonizarMarca = canonizarMarca;
