/**
 * VM Click - pedido do site -> Olist
 *
 * Pedido pago vira pedido de venda no Olist, que é onde a loja emite a nota,
 * separa, baixa o estoque e gera a etiqueta. O painel do site só acompanha.
 *
 *   1. Contato: procura pelo CPF/CNPJ; se não existe, cadastra.
 *   2. Produtos: o id de cada item é buscado pelo código (SKU).
 *   3. Pedido: situação "Aprovada" (já está pago), com frete, desconto,
 *      endereço de entrega e o número do site em "ordem de compra".
 *
 * Falhar aqui nunca desfaz o pagamento: o erro fica gravado no pedido e o
 * painel mostra "Enviar ao Olist" para tentar de novo.
 */

const { olistGet, olistEnviar } = require('./_olist.js');
const armazem = require('./_armazem.js');

const SITUACAO_APROVADA = 3;

const MARCADOR = process.env.OLIST_MARCADOR || 'Site VM Click';

const FORMA = { pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão de crédito' };

function hoje() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function idContato(pedido) {
  const c = pedido.cliente;
  const e = pedido.entrega;
  const busca = await olistGet(`/contatos?cpfCnpj=${encodeURIComponent(c.doc)}&limit=1`);
  const achado = ((busca && busca.itens) || [])[0];
  if (achado && achado.id) return achado.id;

  const novo = await olistEnviar('POST', '/contatos', {
    nome: c.nome,
    tipoPessoa: c.doc.length === 14 ? 'J' : 'F',
    cpfCnpj: c.doc,
    email: c.email,
    celular: c.tel,
    situacao: 'B',
    endereco: e.opcao.tipo === 'retirada' ? undefined : {
      endereco: e.rua, numero: e.numero, complemento: e.compl, bairro: e.bairro,
      municipio: e.cidade, cep: e.cep, uf: e.uf, pais: 'Brasil',
    },
  });
  return novo.id;
}

async function idProduto(sku) {
  const r = await olistGet(`/produtos?limit=1&codigo=${encodeURIComponent(sku)}`);
  const p = ((r && r.itens) || [])[0];
  if (!p || !p.id) throw new Error(`Produto ${sku} não encontrado no Olist`);
  return p.id;
}

function observacoes(pedido) {
  const e = pedido.entrega;
  const linhas = [
    `Pedido ${pedido.numero} do site, pago por ${FORMA[pedido.forma] || pedido.forma}` +
      (pedido.parcelas > 1 ? ` em ${pedido.parcelas}x` : '') + '.',
    `Entrega: ${e.opcao.servico}${e.opcao.transportadora && e.opcao.tipo === 'transportadora' ? ' (' + e.opcao.transportadora + ')' : ''}.`,
  ];
  if (e.aCombinar) linhas.push('Frete a combinar com o cliente (cotação estava fora do ar).');
  return linhas.join(' ');
}

/**
 * Lança o pedido no Olist e devolve { id, numero }. Uma trava no KV impede
 * que dois avisos de pagamento quase simultâneos criem o pedido duas vezes.
 */
async function enviarAoOlist(pedido) {
  if (pedido.olist && pedido.olist.id) return pedido.olist;

  const trava = `vmclick:olist:trava:${pedido.id}`;
  if (!(await armazem.gravarSeNovo(trava, 1, 120))) {
    throw new Error('Envio ao Olist já em andamento');
  }

  try {
    const contato = await idContato(pedido);
    const itens = [];
    for (const i of pedido.itens) {
      itens.push({ produto: { id: await idProduto(i.sku), tipo: 'P' }, quantidade: i.qtd, valorUnitario: i.preco });
    }

    const e = pedido.entrega;
    const retirada = e.opcao.tipo === 'retirada';

    const corpo = {
      data: hoje(),
      idContato: contato,
      situacao: SITUACAO_APROVADA,
      numeroOrdemCompra: pedido.numero,
      valorFrete: pedido.frete,
      valorDesconto: pedido.desconto,
      observacoes: observacoes(pedido),
      observacoesInternas: `Pedido do site ${pedido.id}`,
      transportador: { fretePorConta: retirada ? 'S' : 'R' },
      itens,
    };
    if (!retirada) {
      corpo.enderecoEntrega = {
        endereco: e.rua, enderecoNro: e.numero, complemento: e.compl, bairro: e.bairro,
        municipio: e.cidade, cep: e.cep, uf: e.uf, fone: pedido.cliente.tel,
        nomeDestinatario: pedido.cliente.nome, cpfCnpj: pedido.cliente.doc,
        tipoPessoa: pedido.cliente.doc.length === 14 ? 'J' : 'F',
      };
    }

    const r = await olistEnviar('POST', '/pedidos', corpo);

    /* Marcador "Site VM Click": em Vendas > Pedidos de Venda dá para filtrar
       só os pedidos do site. (A API v3 não tem como ligar o pedido a um canal
       de "Pedidos no e-commerce"; o marcador é o filtro que funciona.)
       Melhor esforço: o pedido já existe, falhar aqui não o desfaz. */
    await olistEnviar('POST', `/pedidos/${r.id}/marcadores`, [{ descricao: MARCADOR }])
      .catch((e) => console.error('[expedicao] marcador no Olist:', e.message));

    return { id: r.id, numero: r.numeroPedido, em: new Date().toISOString() };
  } finally {
    await armazem.apagar(trava).catch(() => {});
  }
}

/** Código de rastreio no pedido do Olist. Melhor esforço. */
async function despachoNoOlist(pedido) {
  if (!pedido.olist || !pedido.olist.id || !pedido.rastreio) return;
  await olistEnviar('PUT', `/pedidos/${pedido.olist.id}/despacho`, {
    codigoRastreamento: pedido.rastreio.codigo || undefined,
    urlRastreamento: pedido.rastreio.url || undefined,
  });
}

module.exports = { enviarAoOlist, despachoNoOlist };
