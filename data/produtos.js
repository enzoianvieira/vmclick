/* ==========================================================================
   VM Click - catálogo de demonstração
   --------------------------------------------------------------------------
   ARQUIVO ÚNICO E SUBSTITUÍVEL. Na fase 2 este arquivo sai e o catálogo passa
   a vir do Olist Tiny (ERP) → WooCommerce. O mapeamento de campos é:

     sku       → SKU / código do produto no Tiny
     nome      → descrição do produto
     preco     → preço de venda
     precoDe   → preço promocional "de" (opcional)
     estoque   → saldo em estoque
     cat       → categoria (taxonomia product_cat)
     marca     → atributo "marca"
     specs     → atributos do produto
     icone     → substituído pela imagem real do produto

   Produtos abaixo são FICTÍCIOS, criados para demonstração da experiência.
   ========================================================================== */

window.VM_CATEGORIAS = [
  {
    slug: 'eletrica',
    nome: 'Materiais elétricos',
    curto: 'Elétrica',
    icone: 'p-disjuntor',
    desc: 'Ampla variedade em materiais de alta e baixa tensão, para estrutura e acabamento, visando segurança e eficiência.'
  },
  {
    slug: 'iluminacao',
    nome: 'Iluminação',
    curto: 'Iluminação',
    icone: 'p-lampada',
    desc: 'Luminárias, lâmpadas de LED e acessórios para iluminação residencial e comercial, com alto fator de luminosidade e certificadas.'
  },
  {
    slug: 'hidraulica',
    nome: 'Materiais hidráulicos',
    curto: 'Hidráulica',
    icone: 'p-registro',
    desc: 'Tubos e conexões para água e esgoto, para pequenos reparos e grandes instalações.'
  },
  {
    slug: 'utilidades',
    nome: 'Utilidades',
    curto: 'Utilidades',
    icone: 'p-alicate',
    desc: 'Ferramentas manuais para eletricistas, encanadores e outros profissionais, além de produtos para manutenção da casa.'
  },
  {
    slug: 'pintura',
    nome: 'Pintura e construção',
    curto: 'Pintura',
    icone: 'p-tinta',
    desc: 'Massas, tintas, EPIs e muito mais. Produtos para todas as demandas da sua obra, reforma ou manutenção.'
  }
];

window.VM_PRODUTOS = [
  /* ---------------------------------------------------------------- ELÉTRICA */
  {
    sku: '41-1877', slug: 'disjuntor-din-monopolar-20a-curva-c', cat: 'eletrica',
    nome: 'Disjuntor DIN Monopolar 20A Curva C', marca: 'Steck',
    preco: 16.40, precoDe: null, estoque: 184, icone: 'p-disjuntor',
    novo: false, destaque: true, nota: 4.8, avaliacoes: 63, unidade: 'un',
    desc: 'Disjuntor termomagnético monopolar para trilho DIN, curva C, corrente nominal de 20A. Proteção contra sobrecarga e curto-circuito em circuitos de tomadas e iluminação residencial.',
    specs: { 'Corrente nominal': '20 A', 'Polos': 'Monopolar (1P)', 'Curva': 'C', 'Capacidade de interrupção': '3 kA', 'Tensão': '127/220 V', 'Fixação': 'Trilho DIN 35 mm', 'Norma': 'NBR NM 60898' }
  },
  {
    sku: '41-1882', slug: 'disjuntor-din-bipolar-40a-curva-c', cat: 'eletrica',
    nome: 'Disjuntor DIN Bipolar 40A Curva C', marca: 'Schneider Electric',
    preco: 62.90, precoDe: null, estoque: 47, icone: 'p-disjuntor',
    novo: false, destaque: false, nota: 4.9, avaliacoes: 28, unidade: 'un',
    desc: 'Disjuntor bipolar para proteção de circuitos de maior carga, como chuveiro elétrico e ar-condicionado. Construção robusta e alta capacidade de interrupção.',
    specs: { 'Corrente nominal': '40 A', 'Polos': 'Bipolar (2P)', 'Curva': 'C', 'Capacidade de interrupção': '5 kA', 'Tensão': '220/380 V', 'Fixação': 'Trilho DIN 35 mm', 'Norma': 'NBR NM 60898' }
  },
  {
    sku: '41-2140', slug: 'idr-interruptor-diferencial-residual-2p-40a-30ma', cat: 'eletrica',
    nome: 'IDR Interruptor Diferencial Residual 2P 40A 30mA', marca: 'Siemens',
    preco: 168.00, precoDe: 198.00, estoque: 22, icone: 'p-disjuntor',
    novo: false, destaque: true, nota: 4.9, avaliacoes: 41, unidade: 'un',
    desc: 'Dispositivo de proteção contra choque elétrico por corrente de fuga. Exigido pela NBR 5410 em circuitos de áreas molhadas, tomadas externas e piscinas.',
    specs: { 'Corrente nominal': '40 A', 'Sensibilidade': '30 mA', 'Polos': '2P', 'Tipo': 'AC', 'Tensão': '220 V', 'Fixação': 'Trilho DIN 35 mm', 'Norma': 'NBR NM 61008' }
  },
  {
    sku: '41-3055', slug: 'dps-protetor-de-surto-275v-20ka', cat: 'eletrica',
    nome: 'DPS Dispositivo Protetor de Surto 275V 20kA', marca: 'Clamper',
    preco: 74.90, precoDe: null, estoque: 58, icone: 'p-disjuntor',
    novo: true, destaque: false, nota: 4.7, avaliacoes: 19, unidade: 'un',
    desc: 'Protege a instalação contra surtos de tensão provocados por descargas atmosféricas e manobras da concessionária. Instalação no quadro de distribuição.',
    specs: { 'Tensão máxima': '275 V', 'Corrente de descarga': '20 kA', 'Classe': 'II', 'Indicador': 'Visual de fim de vida', 'Fixação': 'Trilho DIN 35 mm', 'Norma': 'NBR IEC 61643-1' }
  },
  {
    sku: '41-0912', slug: 'cabo-flexivel-2-5mm-100m-azul-750v', cat: 'eletrica',
    nome: 'Cabo Flexível 2,5mm² 100m Azul 750V', marca: 'Cobrecom',
    preco: 289.90, precoDe: 329.90, estoque: 36, icone: 'p-cabo',
    novo: false, destaque: true, nota: 4.8, avaliacoes: 92, unidade: 'rolo',
    desc: 'Cabo flexível de cobre eletrolítico com isolação em PVC antichama, para circuitos de tomadas de uso geral. Rolo com 100 metros.',
    specs: { 'Seção': '2,5 mm²', 'Tensão de isolamento': '750 V', 'Cor': 'Azul', 'Comprimento': '100 m', 'Condutor': 'Cobre eletrolítico flexível', 'Isolação': 'PVC antichama 70 °C', 'Norma': 'NBR NM 247-3' }
  },
  {
    sku: '41-0908', slug: 'cabo-flexivel-1-5mm-100m-preto-750v', cat: 'eletrica',
    nome: 'Cabo Flexível 1,5mm² 100m Preto 750V', marca: 'Sil',
    preco: 179.90, precoDe: null, estoque: 51, icone: 'p-cabo',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 44, unidade: 'rolo',
    desc: 'Cabo flexível para circuitos de iluminação. Isolação em PVC antichama, alta flexibilidade para passagem em eletroduto.',
    specs: { 'Seção': '1,5 mm²', 'Tensão de isolamento': '750 V', 'Cor': 'Preto', 'Comprimento': '100 m', 'Condutor': 'Cobre eletrolítico flexível', 'Isolação': 'PVC antichama 70 °C', 'Norma': 'NBR NM 247-3' }
  },
  {
    sku: '41-4410', slug: 'tomada-2p-t-10a-branca-placa-4x2', cat: 'eletrica',
    nome: 'Tomada 2P+T 10A Branca com Placa 4x2', marca: 'Pial Legrand',
    preco: 18.50, precoDe: null, estoque: 240, icone: 'p-tomada',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 118, unidade: 'un',
    desc: 'Conjunto montado de tomada padrão brasileiro 2P+T com placa 4x2 e suporte. Acabamento em branco, linha residencial.',
    specs: { 'Corrente': '10 A', 'Padrão': '2P+T (NBR 14136)', 'Tensão': '250 V', 'Placa': '4x2', 'Cor': 'Branco', 'Norma': 'NBR 14136' }
  },
  {
    sku: '41-4425', slug: 'tomada-dupla-2p-t-20a-placa-4x4', cat: 'eletrica',
    nome: 'Tomada Dupla 2P+T 20A com Placa 4x4', marca: 'Tramontina',
    preco: 32.90, precoDe: null, estoque: 96, icone: 'p-tomada',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 57, unidade: 'un',
    desc: 'Conjunto de duas tomadas 20A com placa 4x4, indicado para bancadas de cozinha e área de serviço, onde a carga é maior.',
    specs: { 'Corrente': '20 A', 'Padrão': '2P+T (NBR 14136)', 'Tensão': '250 V', 'Placa': '4x4', 'Cor': 'Branco', 'Norma': 'NBR 14136' }
  },
  {
    sku: '41-4402', slug: 'interruptor-simples-10a-placa-4x2', cat: 'eletrica',
    nome: 'Interruptor Simples 10A com Placa 4x2', marca: 'Steck',
    preco: 14.90, precoDe: null, estoque: 210, icone: 'p-interruptor',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 73, unidade: 'un',
    desc: 'Conjunto montado de interruptor simples com placa 4x2 e suporte. Contatos em prata para maior vida útil.',
    specs: { 'Corrente': '10 A', 'Função': 'Simples', 'Tensão': '250 V', 'Placa': '4x2', 'Cor': 'Branco', 'Norma': 'NBR 60669' }
  },
  {
    sku: '41-5120', slug: 'quadro-distribuicao-embutir-12-disjuntores', cat: 'eletrica',
    nome: 'Quadro de Distribuição de Embutir para 12 Disjuntores', marca: 'Steck',
    preco: 129.00, precoDe: null, estoque: 31, icone: 'p-quadro',
    novo: false, destaque: true, nota: 4.8, avaliacoes: 35, unidade: 'un',
    desc: 'Quadro de distribuição em chapa de aço com pintura eletrostática, barramento de neutro e terra, porta e trilho DIN. Capacidade para 12 disjuntores.',
    specs: { 'Capacidade': '12 disjuntores DIN', 'Instalação': 'Embutir', 'Material': 'Chapa de aço', 'Barramentos': 'Neutro e terra inclusos', 'Grau de proteção': 'IP40', 'Norma': 'NBR IEC 60670-24' }
  },
  {
    sku: '41-6301', slug: 'eletroduto-corrugado-flexivel-25mm-50m', cat: 'eletrica',
    nome: 'Eletroduto Corrugado Flexível 25mm 50m', marca: 'Krona',
    preco: 89.90, precoDe: null, estoque: 64, icone: 'p-eletroduto',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 26, unidade: 'rolo',
    desc: 'Eletroduto corrugado em PVC antichama para instalação embutida em laje e alvenaria. Rolo com 50 metros.',
    specs: { 'Diâmetro': '25 mm', 'Comprimento': '50 m', 'Material': 'PVC antichama', 'Cor': 'Amarelo', 'Aplicação': 'Embutido em laje e parede', 'Norma': 'NBR 15465' }
  },

  /* ------------------------------------------------------------- ILUMINAÇÃO */
  {
    sku: '41-2290', slug: 'lampada-led-bulbo-15w-6500k-bivolt', cat: 'iluminacao',
    nome: 'Lâmpada LED Bulbo 15W 6500K Bivolt', marca: 'Avant',
    preco: 19.90, precoDe: 24.90, estoque: 320, icone: 'p-lampada',
    novo: false, destaque: true, nota: 4.7, avaliacoes: 210, unidade: 'un',
    desc: 'Lâmpada LED bulbo de alto fator de potência, luz branca fria. Substitui a incandescente de 100W com economia de até 85% de energia.',
    specs: { 'Potência': '15 W', 'Fluxo luminoso': '1520 lm', 'Temperatura de cor': '6500 K (branco frio)', 'Base': 'E27', 'Tensão': 'Bivolt (100–240 V)', 'Vida útil': '25.000 h', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-2284', slug: 'lampada-led-bulbo-9w-3000k-bivolt', cat: 'iluminacao',
    nome: 'Lâmpada LED Bulbo 9W 3000K Bivolt', marca: 'Philips',
    preco: 14.90, precoDe: null, estoque: 285, icone: 'p-lampada',
    novo: false, destaque: false, nota: 4.8, avaliacoes: 164, unidade: 'un',
    desc: 'Lâmpada LED bulbo com luz amarela quente, indicada para salas e dormitórios onde se busca ambiente acolhedor.',
    specs: { 'Potência': '9 W', 'Fluxo luminoso': '806 lm', 'Temperatura de cor': '3000 K (branco quente)', 'Base': 'E27', 'Tensão': 'Bivolt (100–240 V)', 'Vida útil': '15.000 h', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-2318', slug: 'lampada-led-tubular-t8-18w-120cm-6500k', cat: 'iluminacao',
    nome: 'Lâmpada LED Tubular T8 18W 120cm 6500K', marca: 'Philips',
    preco: 24.90, precoDe: null, estoque: 148, icone: 'p-lampada',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 88, unidade: 'un',
    desc: 'Tubular LED para substituição direta da fluorescente T8 de 36W. Não necessita reator, apenas bypass na luminária.',
    specs: { 'Potência': '18 W', 'Fluxo luminoso': '1850 lm', 'Temperatura de cor': '6500 K', 'Comprimento': '120 cm', 'Base': 'G13', 'Tensão': 'Bivolt', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-2705', slug: 'painel-led-embutir-quadrado-24w-4000k', cat: 'iluminacao',
    nome: 'Painel LED de Embutir Quadrado 24W 4000K', marca: 'Taschibra',
    preco: 68.90, precoDe: null, estoque: 74, icone: 'p-luminaria',
    novo: false, destaque: true, nota: 4.7, avaliacoes: 52, unidade: 'un',
    desc: 'Painel LED de embutir em forro de gesso, com difusor leitoso e luz uniforme. Luz neutra, ótima para cozinhas e escritórios.',
    specs: { 'Potência': '24 W', 'Fluxo luminoso': '1920 lm', 'Temperatura de cor': '4000 K (neutro)', 'Dimensões': '30 × 30 cm', 'Recorte': '28 × 28 cm', 'Tensão': 'Bivolt', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-2712', slug: 'plafon-led-sobrepor-redondo-18w-6500k', cat: 'iluminacao',
    nome: 'Plafon LED de Sobrepor Redondo 18W 6500K', marca: 'Intral',
    preco: 54.90, precoDe: null, estoque: 91, icone: 'p-luminaria',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 39, unidade: 'un',
    desc: 'Plafon de sobrepor para lajes sem forro, com corpo em alumínio e difusor em policarbonato.',
    specs: { 'Potência': '18 W', 'Fluxo luminoso': '1440 lm', 'Temperatura de cor': '6500 K', 'Diâmetro': '22 cm', 'Instalação': 'Sobrepor', 'Tensão': 'Bivolt', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-2820', slug: 'spot-led-embutir-direcionavel-7w-3000k', cat: 'iluminacao',
    nome: 'Spot LED de Embutir Direcionável 7W 3000K', marca: 'Taschibra',
    preco: 34.90, precoDe: null, estoque: 132, icone: 'p-luminaria',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 61, unidade: 'un',
    desc: 'Spot de embutir com foco direcionável, ideal para iluminação de destaque em quadros, bancadas e nichos.',
    specs: { 'Potência': '7 W', 'Fluxo luminoso': '560 lm', 'Temperatura de cor': '3000 K', 'Ângulo': '38° direcionável', 'Recorte': '7 cm', 'Tensão': 'Bivolt', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-3402', slug: 'refletor-led-100w-ip66-6500k', cat: 'iluminacao',
    nome: 'Refletor LED 100W IP66 6500K Bivolt', marca: 'Foxlux',
    preco: 129.90, precoDe: 159.90, estoque: 43, icone: 'p-refletor',
    novo: false, destaque: true, nota: 4.7, avaliacoes: 77, unidade: 'un',
    desc: 'Refletor LED para áreas externas, fachadas, pátios e quadras. Corpo em alumínio com vedação IP66 contra chuva e poeira.',
    specs: { 'Potência': '100 W', 'Fluxo luminoso': '9000 lm', 'Temperatura de cor': '6500 K', 'Grau de proteção': 'IP66', 'Ângulo': '120°', 'Tensão': 'Bivolt', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-3398', slug: 'refletor-led-50w-ip66-6500k', cat: 'iluminacao',
    nome: 'Refletor LED 50W IP66 6500K Bivolt', marca: 'Avant',
    preco: 79.90, precoDe: null, estoque: 67, icone: 'p-refletor',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 48, unidade: 'un',
    desc: 'Refletor LED compacto para iluminação de garagens, muros e áreas de circulação externa.',
    specs: { 'Potência': '50 W', 'Fluxo luminoso': '4500 lm', 'Temperatura de cor': '6500 K', 'Grau de proteção': 'IP66', 'Ângulo': '120°', 'Tensão': 'Bivolt', 'Certificação': 'INMETRO' }
  },
  {
    sku: '41-3610', slug: 'fita-led-5m-12v-6500k-com-fonte', cat: 'iluminacao',
    nome: 'Fita LED 5m 12V 6500K IP20 com Fonte', marca: 'Osram',
    preco: 89.90, precoDe: null, estoque: 55, icone: 'p-fita-led',
    novo: true, destaque: false, nota: 4.6, avaliacoes: 33, unidade: 'kit',
    desc: 'Kit de fita LED com fonte inclusa, para sanca de gesso e iluminação indireta em ambientes internos. Adesivo 3M na base.',
    specs: { 'Comprimento': '5 m', 'Tensão': '12 V', 'Temperatura de cor': '6500 K', 'LEDs': '300 (60/m)', 'Grau de proteção': 'IP20 (uso interno)', 'Fonte': 'Inclusa, bivolt', 'Potência': '24 W' }
  },
  {
    sku: '41-3705', slug: 'arandela-led-externa-2x3w-ip54-preta', cat: 'iluminacao',
    nome: 'Arandela LED Externa 2x3W IP54 Preta', marca: 'Avant',
    preco: 79.00, precoDe: null, estoque: 38, icone: 'p-luminaria',
    novo: true, destaque: false, nota: 4.4, avaliacoes: 17, unidade: 'un',
    desc: 'Arandela de parede com dois focos, para fachadas e áreas externas cobertas. Efeito de luz vertical.',
    specs: { 'Potência': '2 × 3 W', 'Temperatura de cor': '3000 K', 'Grau de proteção': 'IP54', 'Material': 'Alumínio', 'Cor': 'Preto', 'Tensão': 'Bivolt' }
  },
  {
    sku: '41-3810', slug: 'sensor-de-presenca-teto-360-6m', cat: 'iluminacao',
    nome: 'Sensor de Presença de Teto 360° 6m Bivolt', marca: 'Steck',
    preco: 46.90, precoDe: null, estoque: 82, icone: 'p-sensor',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 45, unidade: 'un',
    desc: 'Sensor infravermelho de presença para corredores, garagens e áreas de passagem. Tempo e luminosidade ajustáveis.',
    specs: { 'Alcance': '6 m', 'Ângulo': '360°', 'Carga máxima': '1200 W', 'Ajustes': 'Tempo e fotocélula', 'Instalação': 'Teto', 'Tensão': 'Bivolt' }
  },

  /* -------------------------------------------------------------- HIDRÁULICA */
  {
    sku: '41-0342', slug: 'tubo-pvc-soldavel-25mm-barra-6m', cat: 'hidraulica',
    nome: 'Tubo PVC Soldável 25mm - barra de 6m', marca: 'Tigre',
    preco: 38.70, precoDe: null, estoque: 0, icone: 'p-tubo',
    novo: false, destaque: false, nota: 4.8, avaliacoes: 96, unidade: 'barra',
    desc: 'Tubo em PVC rígido soldável para condução de água fria sob pressão. Barra de 6 metros.',
    specs: { 'Diâmetro': '25 mm', 'Comprimento': '6 m', 'Tipo': 'Soldável', 'Pressão de serviço': '7,5 kgf/cm²', 'Aplicação': 'Água fria', 'Norma': 'NBR 5648' }
  },
  {
    sku: '41-0361', slug: 'tubo-pvc-esgoto-100mm-barra-6m', cat: 'hidraulica',
    nome: 'Tubo PVC Esgoto 100mm - barra de 6m', marca: 'Amanco',
    preco: 128.90, precoDe: null, estoque: 27, icone: 'p-tubo',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 42, unidade: 'barra',
    desc: 'Tubo em PVC para rede coletora de esgoto predial, com ponta e bolsa para junta elástica.',
    specs: { 'Diâmetro': '100 mm', 'Comprimento': '6 m', 'Tipo': 'Ponta e bolsa', 'Aplicação': 'Esgoto predial', 'Cor': 'Branco', 'Norma': 'NBR 5688' }
  },
  {
    sku: '41-0410', slug: 'joelho-pvc-soldavel-90-25mm', cat: 'hidraulica',
    nome: 'Joelho PVC Soldável 90° 25mm', marca: 'Tigre',
    preco: 2.90, precoDe: null, estoque: 640, icone: 'p-joelho',
    novo: false, destaque: false, nota: 4.9, avaliacoes: 152, unidade: 'un',
    desc: 'Conexão para mudança de direção em 90° em tubulação soldável de água fria.',
    specs: { 'Diâmetro': '25 mm', 'Ângulo': '90°', 'Tipo': 'Soldável', 'Material': 'PVC rígido', 'Aplicação': 'Água fria', 'Norma': 'NBR 5648' }
  },
  {
    sku: '41-0418', slug: 'te-pvc-soldavel-25mm', cat: 'hidraulica',
    nome: 'Tê PVC Soldável 25mm', marca: 'Krona',
    preco: 3.80, precoDe: null, estoque: 480, icone: 'p-joelho',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 88, unidade: 'un',
    desc: 'Conexão para derivação de ramal em tubulação soldável de água fria.',
    specs: { 'Diâmetro': '25 mm', 'Tipo': 'Soldável', 'Material': 'PVC rígido', 'Aplicação': 'Água fria', 'Norma': 'NBR 5648' }
  },
  {
    sku: '41-0525', slug: 'registro-esfera-pvc-soldavel-25mm', cat: 'hidraulica',
    nome: 'Registro de Esfera PVC Soldável 25mm', marca: 'Tigre',
    preco: 24.90, precoDe: null, estoque: 118, icone: 'p-registro',
    novo: false, destaque: true, nota: 4.7, avaliacoes: 64, unidade: 'un',
    desc: 'Registro de esfera para bloqueio rápido do fluxo de água em ramais e caixas d\'água. Abertura em 1/4 de volta.',
    specs: { 'Diâmetro': '25 mm', 'Tipo': 'Esfera, soldável', 'Acionamento': '1/4 de volta', 'Material': 'PVC', 'Pressão de serviço': '7,5 kgf/cm²', 'Norma': 'NBR 14968' }
  },
  {
    sku: '41-0560', slug: 'registro-gaveta-bruto-3-4', cat: 'hidraulica',
    nome: 'Registro de Gaveta Bruto 3/4"', marca: 'Docol',
    preco: 58.90, precoDe: null, estoque: 46, icone: 'p-registro',
    novo: false, destaque: false, nota: 4.8, avaliacoes: 37, unidade: 'un',
    desc: 'Registro de gaveta em latão para instalação embutida na parede, com acabamento posterior por canopla.',
    specs: { 'Bitola': '3/4"', 'Tipo': 'Gaveta bruto', 'Material': 'Latão', 'Aplicação': 'Água fria e quente', 'Norma': 'NBR 15704' }
  },
  {
    sku: '41-0705', slug: 'torneira-parede-cozinha-bica-movel-cromada', cat: 'hidraulica',
    nome: 'Torneira de Parede para Cozinha Bica Móvel Cromada', marca: 'Docol',
    preco: 149.00, precoDe: 179.00, estoque: 34, icone: 'p-torneira',
    novo: false, destaque: true, nota: 4.8, avaliacoes: 71, unidade: 'un',
    desc: 'Torneira de parede com bica móvel e arejador, acabamento cromado. Corpo em metal, alta durabilidade.',
    specs: { 'Instalação': 'Parede', 'Bitola': '1/2"', 'Acabamento': 'Cromado', 'Material': 'Metal', 'Bica': 'Móvel com arejador', 'Garantia': '5 anos' }
  },
  {
    sku: '41-0880', slug: 'valvula-de-descarga-1-1-2', cat: 'hidraulica',
    nome: 'Válvula de Descarga 1.1/2"', marca: 'Deca',
    preco: 219.00, precoDe: null, estoque: 19, icone: 'p-registro',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 23, unidade: 'un',
    desc: 'Válvula de descarga com regulagem de vazão e acabamento cromado, para instalação em vaso sanitário convencional.',
    specs: { 'Bitola': '1.1/2"', 'Acionamento': 'Manual', 'Regulagem': 'De vazão', 'Acabamento': 'Cromado', 'Material': 'Metal', 'Garantia': '5 anos' }
  },
  {
    sku: '41-0930', slug: 'caixa-dagua-polietileno-500l-com-tampa', cat: 'hidraulica',
    nome: 'Caixa d\'Água em Polietileno 500L com Tampa', marca: 'Fortlev',
    preco: 389.00, precoDe: null, estoque: 12, icone: 'p-caixa-agua',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 29, unidade: 'un',
    desc: 'Reservatório em polietileno com proteção UV e tampa de rosca, atóxico e resistente a impacto.',
    specs: { 'Capacidade': '500 L', 'Material': 'Polietileno', 'Proteção': 'UV', 'Tampa': 'Inclusa', 'Diâmetro': '104 cm', 'Norma': 'NBR 14799' }
  },
  {
    sku: '41-1010', slug: 'adesivo-plastico-para-pvc-175g', cat: 'hidraulica',
    nome: 'Adesivo Plástico para PVC 175g', marca: 'Tigre',
    preco: 21.90, precoDe: null, estoque: 154, icone: 'p-tinta',
    novo: false, destaque: false, nota: 4.8, avaliacoes: 105, unidade: 'un',
    desc: 'Adesivo para soldagem a frio de tubos e conexões em PVC rígido. Bisnaga com bico aplicador.',
    specs: { 'Peso': '175 g', 'Aplicação': 'PVC rígido soldável', 'Tempo de cura': '12 h para pressurizar', 'Embalagem': 'Bisnaga com bico', 'Rendimento': '~90 juntas de 25 mm' }
  },
  {
    sku: '41-1120', slug: 'sifao-sanfonado-universal-branco', cat: 'hidraulica',
    nome: 'Sifão Sanfonado Universal Branco', marca: 'Astra',
    preco: 16.90, precoDe: null, estoque: 176, icone: 'p-tubo',
    novo: false, destaque: false, nota: 4.3, avaliacoes: 66, unidade: 'un',
    desc: 'Sifão sanfonado flexível para pias e lavatórios, com ajuste de comprimento e vedação por anel.',
    specs: { 'Saída': '1.1/2" universal', 'Material': 'PVC flexível', 'Cor': 'Branco', 'Aplicação': 'Pia, lavatório e tanque' }
  },

  /* -------------------------------------------------------------- UTILIDADES */
  {
    sku: '41-5510', slug: 'alicate-universal-8-isolado-1000v', cat: 'utilidades',
    nome: 'Alicate Universal 8" Isolado 1000V', marca: 'Tramontina',
    preco: 89.90, precoDe: null, estoque: 58, icone: 'p-alicate',
    novo: false, destaque: true, nota: 4.9, avaliacoes: 134, unidade: 'un',
    desc: 'Alicate universal em aço cromo-vanádio com isolação testada a 1000V, para trabalho em circuitos energizados de baixa tensão.',
    specs: { 'Tamanho': '8"', 'Isolação': '1000 V', 'Material': 'Aço cromo-vanádio', 'Acabamento': 'Cromado', 'Norma': 'IEC 60900', 'Garantia': 'Vitalícia' }
  },
  {
    sku: '41-5518', slug: 'alicate-bico-meia-cana-6-isolado', cat: 'utilidades',
    nome: 'Alicate de Bico Meia-Cana 6" Isolado', marca: 'Vonder',
    preco: 59.90, precoDe: null, estoque: 72, icone: 'p-alicate',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 51, unidade: 'un',
    desc: 'Alicate de bico longo para trabalhos em espaços reduzidos, quadros e caixas de passagem.',
    specs: { 'Tamanho': '6"', 'Isolação': '1000 V', 'Material': 'Aço cromo-vanádio', 'Formato do bico': 'Meia-cana longo', 'Norma': 'IEC 60900' }
  },
  {
    sku: '41-5524', slug: 'alicate-corte-diagonal-6-isolado-1000v', cat: 'utilidades',
    nome: 'Alicate de Corte Diagonal 6" Isolado 1000V', marca: 'Gedore',
    preco: 74.90, precoDe: null, estoque: 44, icone: 'p-alicate',
    novo: false, destaque: false, nota: 4.8, avaliacoes: 62, unidade: 'un',
    desc: 'Alicate de corte diagonal com fio temperado, para corte preciso de condutores de cobre.',
    specs: { 'Tamanho': '6"', 'Isolação': '1000 V', 'Capacidade de corte': 'Até 4 mm² cobre', 'Material': 'Aço cromo-vanádio', 'Norma': 'IEC 60900' }
  },
  {
    sku: '41-5602', slug: 'jogo-chaves-fenda-philips-6-pecas', cat: 'utilidades',
    nome: 'Jogo de Chaves de Fenda e Philips 6 Peças', marca: 'Gedore',
    preco: 79.90, precoDe: null, estoque: 39, icone: 'p-chave-fenda',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 58, unidade: 'jogo',
    desc: 'Jogo com três chaves de fenda e três Philips, cabo anatômico antiderrapante e haste em aço cromo-vanádio.',
    specs: { 'Peças': '6', 'Perfis': 'Fenda e Philips', 'Material': 'Aço cromo-vanádio', 'Cabo': 'Anatômico bimaterial', 'Garantia': 'Vitalícia' }
  },
  {
    sku: '41-5620', slug: 'chave-de-teste-neon-1000v-4', cat: 'utilidades',
    nome: 'Chave de Teste Neon 1000V 4"', marca: 'Foxlux',
    preco: 12.90, precoDe: null, estoque: 195, icone: 'p-chave-fenda',
    novo: false, destaque: false, nota: 4.2, avaliacoes: 87, unidade: 'un',
    desc: 'Chave de teste com lâmpada neon para identificação rápida de fase em tomadas e circuitos.',
    specs: { 'Tamanho': '4"', 'Tensão': '100–500 V', 'Indicação': 'Lâmpada neon', 'Cabo': 'Isolado transparente' }
  },
  {
    sku: '41-5634', slug: 'chave-philips-1-4-x-6-cabo-isolado', cat: 'utilidades',
    nome: 'Chave Philips 1/4" × 6" Cabo Isolado', marca: 'Tramontina',
    preco: 26.90, precoDe: null, estoque: 121, icone: 'p-chave-fenda',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 43, unidade: 'un',
    desc: 'Chave Philips com haste longa e cabo isolado, para parafusos de quadros e tomadas.',
    specs: { 'Perfil': 'Philips', 'Bitola': '1/4"', 'Haste': '6"', 'Isolação': '1000 V', 'Material': 'Aço cromo-vanádio' }
  },
  {
    sku: '41-5710', slug: 'trena-automatica-5m-x-19mm', cat: 'utilidades',
    nome: 'Trena Automática 5m × 19mm', marca: 'Stanley',
    preco: 34.90, precoDe: null, estoque: 98, icone: 'p-trena',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 112, unidade: 'un',
    desc: 'Trena com fita de aço revestida, trava e clipe de cinto. Corpo em ABS resistente a impacto.',
    specs: { 'Comprimento': '5 m', 'Largura da fita': '19 mm', 'Trava': 'Automática', 'Corpo': 'ABS', 'Clipe': 'Para cinto' }
  },
  {
    sku: '41-5716', slug: 'trena-automatica-8m-x-25mm', cat: 'utilidades',
    nome: 'Trena Automática 8m × 25mm', marca: 'Vonder',
    preco: 54.90, precoDe: null, estoque: 61, icone: 'p-trena',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 47, unidade: 'un',
    desc: 'Trena de 8 metros com fita larga, indicada para medições em obra com maior vão livre.',
    specs: { 'Comprimento': '8 m', 'Largura da fita': '25 mm', 'Trava': 'Automática', 'Corpo': 'ABS emborrachado' }
  },
  {
    sku: '41-5840', slug: 'multimetro-digital-profissional', cat: 'utilidades',
    nome: 'Multímetro Digital Profissional', marca: 'Minipa',
    preco: 129.00, precoDe: 159.00, estoque: 29, icone: 'p-trena',
    novo: true, destaque: true, nota: 4.8, avaliacoes: 54, unidade: 'un',
    desc: 'Multímetro digital com medição de tensão, corrente, resistência, continuidade e teste de diodo. Acompanha pontas de prova.',
    specs: { 'Display': '3.1/2 dígitos', 'Tensão DC': 'Até 600 V', 'Tensão AC': 'Até 600 V', 'Corrente': 'Até 10 A', 'Funções': 'Resistência, continuidade, diodo', 'Acompanha': 'Pontas de prova e bateria' }
  },
  {
    sku: '41-5905', slug: 'fita-isolante-antichama-19mm-x-20m', cat: 'utilidades',
    nome: 'Fita Isolante Antichama 19mm × 20m', marca: '3M',
    preco: 12.90, precoDe: null, estoque: 410, icone: 'p-fita-led',
    novo: false, destaque: false, nota: 4.9, avaliacoes: 231, unidade: 'un',
    desc: 'Fita isolante de PVC autoextinguível para emendas e isolação de condutores até 750V.',
    specs: { 'Largura': '19 mm', 'Comprimento': '20 m', 'Tensão': 'Até 750 V', 'Propriedade': 'Antichama', 'Cor': 'Preto', 'Norma': 'NBR 5410' }
  },

  /* --------------------------------------------------------------- PINTURA */
  {
    sku: '41-7010', slug: 'tinta-acrilica-fosca-branco-neve-18l', cat: 'pintura',
    nome: 'Tinta Acrílica Fosca Branco Neve 18L', marca: 'Suvinil',
    preco: 289.90, precoDe: 339.90, estoque: 24, icone: 'p-tinta',
    novo: false, destaque: true, nota: 4.8, avaliacoes: 96, unidade: 'lata',
    desc: 'Tinta acrílica fosca de alto rendimento para paredes internas e externas, lavável e resistente ao tempo.',
    specs: { 'Volume': '18 L', 'Acabamento': 'Fosco', 'Cor': 'Branco neve', 'Rendimento': 'Até 400 m² por demão', 'Diluição': 'Água, até 20%', 'Secagem': '30 min ao toque' }
  },
  {
    sku: '41-7024', slug: 'tinta-acrilica-premium-fosca-3-6l-branco', cat: 'pintura',
    nome: 'Tinta Acrílica Premium Fosca 3,6L Branco', marca: 'Coral',
    preco: 129.90, precoDe: null, estoque: 58, icone: 'p-tinta',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 64, unidade: 'lata',
    desc: 'Tinta acrílica premium com maior cobertura por demão, indicada para ambientes internos.',
    specs: { 'Volume': '3,6 L', 'Acabamento': 'Fosco', 'Cor': 'Branco', 'Rendimento': 'Até 80 m² por demão', 'Diluição': 'Água, até 20%', 'Secagem': '30 min ao toque' }
  },
  {
    sku: '41-7130', slug: 'esmalte-sintetico-brilhante-branco-900ml', cat: 'pintura',
    nome: 'Esmalte Sintético Brilhante Branco 900ml', marca: 'Suvinil',
    preco: 74.90, precoDe: null, estoque: 71, icone: 'p-tinta',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 38, unidade: 'lata',
    desc: 'Esmalte sintético para madeira e metal, com acabamento brilhante e proteção contra corrosão.',
    specs: { 'Volume': '900 ml', 'Acabamento': 'Brilhante', 'Superfícies': 'Madeira e metal', 'Rendimento': 'Até 18 m² por demão', 'Diluição': 'Aguarrás', 'Secagem': '4 h entre demãos' }
  },
  {
    sku: '41-7240', slug: 'massa-corrida-pva-25kg', cat: 'pintura',
    nome: 'Massa Corrida PVA 25kg', marca: 'Quartzolit',
    preco: 62.90, precoDe: null, estoque: 82, icone: 'p-massa',
    novo: false, destaque: false, nota: 4.5, avaliacoes: 52, unidade: 'saco',
    desc: 'Massa corrida à base de PVA para nivelamento de paredes internas antes da pintura.',
    specs: { 'Peso': '25 kg', 'Aplicação': 'Interna', 'Base': 'PVA', 'Rendimento': 'Até 40 m² por demão', 'Secagem': '3 h entre demãos' }
  },
  {
    sku: '41-7252', slug: 'massa-acrilica-18l', cat: 'pintura',
    nome: 'Massa Acrílica 18L', marca: 'Quartzolit',
    preco: 119.00, precoDe: null, estoque: 47, icone: 'p-massa',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 31, unidade: 'balde',
    desc: 'Massa acrílica para nivelamento de superfícies internas e externas, resistente à umidade.',
    specs: { 'Volume': '18 L', 'Aplicação': 'Interna e externa', 'Base': 'Acrílica', 'Rendimento': 'Até 45 m² por demão', 'Secagem': '4 h entre demãos' }
  },
  {
    sku: '41-7410', slug: 'rolo-de-la-antigota-23cm-com-cabo', cat: 'pintura',
    nome: 'Rolo de Lã Antigota 23cm com Cabo', marca: 'Atlas',
    preco: 34.90, precoDe: null, estoque: 143, icone: 'p-rolo',
    novo: false, destaque: false, nota: 4.7, avaliacoes: 89, unidade: 'un',
    desc: 'Rolo de lã sintética antigota para tintas à base de água, com cabo plástico rosqueável.',
    specs: { 'Largura': '23 cm', 'Pelo': 'Lã sintética antigota', 'Aplicação': 'Tintas à base de água', 'Cabo': 'Incluso, rosqueável' }
  },
  {
    sku: '41-7422', slug: 'kit-pintura-5-pecas', cat: 'pintura',
    nome: 'Kit Pintura 5 Peças - Bandeja, Rolo e Pincéis', marca: 'Atlas',
    preco: 49.90, precoDe: null, estoque: 76, icone: 'p-rolo',
    novo: false, destaque: false, nota: 4.4, avaliacoes: 41, unidade: 'kit',
    desc: 'Kit completo para pintura residencial: bandeja plástica, rolo de lã com cabo e dois pincéis.',
    specs: { 'Peças': '5', 'Inclui': 'Bandeja, rolo 23 cm, cabo e 2 pincéis', 'Aplicação': 'Tintas à base de água' }
  },
  {
    sku: '41-7810', slug: 'capacete-de-seguranca-classe-b-branco', cat: 'pintura',
    nome: 'Capacete de Segurança Classe B Branco', marca: '3M',
    preco: 32.90, precoDe: null, estoque: 104, icone: 'p-epi',
    novo: false, destaque: false, nota: 4.6, avaliacoes: 57, unidade: 'un',
    desc: 'Capacete de segurança com carneira ajustável, para proteção contra impactos e choque elétrico.',
    specs: { 'Classe': 'B (isolante elétrico)', 'Material': 'Polietileno', 'Ajuste': 'Carneira com catraca', 'Cor': 'Branco', 'CA': 'Certificado de Aprovação MTE' }
  },
  {
    sku: '41-7824', slug: 'luva-de-seguranca-nitrilica-tam-g', cat: 'pintura',
    nome: 'Luva de Segurança Nitrílica Tam. G (par)', marca: 'Vonder',
    preco: 14.90, precoDe: null, estoque: 218, icone: 'p-epi',
    novo: false, destaque: false, nota: 4.3, avaliacoes: 73, unidade: 'par',
    desc: 'Luva de proteção com revestimento nitrílico, alta aderência e resistência à abrasão.',
    specs: { 'Tamanho': 'G', 'Revestimento': 'Nitrílico', 'Aplicação': 'Manuseio geral e obra', 'CA': 'Certificado de Aprovação MTE' }
  },
  {
    sku: '41-7836', slug: 'oculos-de-protecao-incolor-antirrisco', cat: 'pintura',
    nome: 'Óculos de Proteção Incolor Antirrisco', marca: '3M',
    preco: 19.90, precoDe: null, estoque: 167, icone: 'p-epi',
    novo: true, destaque: false, nota: 4.5, avaliacoes: 62, unidade: 'un',
    desc: 'Óculos de proteção com lente em policarbonato incolor, tratamento antirrisco e hastes ajustáveis.',
    specs: { 'Lente': 'Policarbonato incolor', 'Tratamento': 'Antirrisco', 'Proteção': 'UV', 'CA': 'Certificado de Aprovação MTE' }
  }
];

