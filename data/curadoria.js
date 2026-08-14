/* ==========================================================================
   VM Click - curadoria da home  (ARQUIVO EDITÁVEL À MÃO)
   --------------------------------------------------------------------------
   Este arquivo NÃO é gerado por script e NÃO é sobrescrito pelo sync do Olist.
   Ele é a única fonte de verdade de duas vitrines da home:

     destaques  → "Destaques da loja"  (ordem da lista = ordem na vitrine)
     ofertas    → "Ofertas da semana"  (preço de referência riscado no card)

   Como editar:
     1. pegue o `sku` do produto (aparece no card e na URL da PDP)
     2. destaques: some o sku na lista, na posição que quiser
     3. ofertas: { sku, precoDe } — `precoDe` é o preço ANTERIOR, sempre maior
        que o preço atual do catálogo; o desconto é calculado a partir dele
     4. sku que não existir mais no catálogo é ignorado sem quebrar a página

   ⚠ Os valores de `precoDe` abaixo são de demonstração. Antes de publicar
   como loja real, troque pelos preços de referência praticados — preço "de"
   que nunca foi cobrado é publicidade enganosa (CDC, art. 37).
   ========================================================================== */

window.VM_CURADORIA = {
  destaques: [
    'ECT004',              // Eletroduto corrugado Tigre 25mm 50m
    'DDS7892327511405',    // Disjuntor DIN Soprano 3P 20A
    'CFC029',              // Cabo flexível Corfio 2,5mm rolo 100m
    'F2P8720169256675',    // Fita LED Philips 24V 2700K 5m
    'CPW7899058031059',    // Caixa de passagem WEG 20x20 embutir
    'ANV7893946480431',    // Alicate nivelador de piso Vonder
    'FI37891040004416',    // Fita isolante 3M 33+ 19mm x 20m
    'CRV7893946106928',    // Cantoneira reforçada Vonder 30cm
    'DDS7893401194743',    // Disjuntor DIN Steck 2P 40A
    'CMS7898623745544',    // Caixa multiuso Sibratec C20
  ],

  ofertas: [
    { sku: 'DDS7893401194729', precoDe: 42.90 },   // Disjuntor DIN Steck 2P 20A
    { sku: 'CPW7899058031066', precoDe: 149.90 },  // Caixa de passagem WEG 30x30
    { sku: 'ECT002',           precoDe: 135.90 },  // Eletroduto corrugado Tigre 25mm AM
    { sku: 'FCT7891395068132', precoDe: 18.90 },   // Fita crepe Tigre 48mm x 50m
    { sku: 'ANH7890176026941', precoDe: 19.90 },   // Abraçadeira nylon HellermannTyton
    { sku: 'BNS7898640447315', precoDe: 18.50 },   // Barramento de neutro Sibratec 12 furos
    { sku: 'FD37891040075126', precoDe: 24.90 },   // Fita dupla face 3M 12mm
    { sku: 'CRV7893946106904', precoDe: 21.50 },   // Cantoneira reforçada Vonder 20cm
  ],
};
