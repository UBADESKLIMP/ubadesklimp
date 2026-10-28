/**
 * Leitura do pedido (ou orçamento) impresso pelo ERP, em PDF ou em planilha.
 *
 * É o documento de UM cliente: no alto os dados da loja, depois "ORÇAMENTO
 * *55210* - 27/10/2026", os dados do cliente (RAZÃO, FANTASIA, ENDEREÇO, CEP,
 * FONE/EMAIL, ENTREGAR EM), a tabela de itens (CÓDIGO, QT, MERCADORIA,
 * VR.UNIT., VR.TOTAL) e o total. Os dois formatos viram a mesma coisa: uma
 * lista de linhas, cada linha com os textos da esquerda para a direita. Daí em
 * diante a leitura é a mesma, e não depende de coluna nem de posição fixa.
 *
 * Sem dependências do navegador, para poder rodar em teste fora do site.
 */

export type LinhaDeTextos = string[];

export interface ItemDoPedido {
  descricao: string;
  quantidade: number;
  unidade?: string;
  valor_unitario?: number;
  valor_total?: number;
}

export interface PedidoLido {
  documento_tipo: string;
  documento_numero: string;
  documento_data: string | null;
  cliente_codigo: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  entregar_em: string | null;
  valor: number | null;
  itens: ItemDoPedido[];
  avisos: string[];
}

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const limpar = (s: string | undefined | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "1.234,50" -> 1234.5 ; "R$424,49" -> 424.49 ; "12,00" -> 12 */
export const numeroBR = (s: string | undefined | null): number | null => {
  if (!s) return null;
  const limpo = String(s).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!/^-?[\d.]*\d(,\d+)?$/.test(limpo)) return null;
  const n = Number(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const ehDinheiro = (s: string) => /^R\$\s*[\d.]*\d,\d{2}$/.test(s.trim());

const UNIDADES = /^(UN|FD|GL|CX|PCT|PC|KG|LT|FR|PT|RL|DP|BD|SC|PAR|JG|KIT|MT|CT|FARDO|DZ|BL)\s+(.+)$/i;

const dataISO = (br: string): string | null => {
  const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** O texto que vem logo depois do rótulo, na mesma linha. */
const depoisDe = (linha: LinhaDeTextos, i: number, juntarResto = false): string | null => {
  const resto = linha.slice(i + 1).map(limpar).filter(Boolean);
  if (resto.length === 0) return null;
  return juntarResto ? resto.join(' ') : resto[0];
};

const acharCelula = (linhas: LinhaDeTextos[], rotulo: RegExp) => {
  for (let l = 0; l < linhas.length; l++) {
    for (let c = 0; c < linhas[l].length; c++) {
      if (rotulo.test(semAcento(linhas[l][c]))) return { l, c };
    }
  }
  return null;
};

const campoPorRotulo = (linhas: LinhaDeTextos[], rotulo: RegExp, juntarResto = false) => {
  const achou = acharCelula(linhas, rotulo);
  return achou ? depoisDe(linhas[achou.l], achou.c, juntarResto) : null;
};

const quebrarEndereco = (texto: string | null) => {
  if (!texto) return { logradouro: null, numero: null, bairro: null };
  const m = texto.match(/^(.*?),\s*([^-]*?)\s*-\s*(.+)$/);
  if (m) return { logradouro: limpar(m[1]) || null, numero: limpar(m[2]) || null, bairro: limpar(m[3]) || null };
  const virgula = texto.match(/^(.*?),\s*(.+)$/);
  if (virgula) return { logradouro: limpar(virgula[1]), numero: limpar(virgula[2]), bairro: null };
  return { logradouro: limpar(texto), numero: null, bairro: null };
};

const bairroConhecidoNoTexto = (texto: string, conhecidos: string[]): string | null => {
  const alvo = semAcento(texto);
  let melhor: string | null = null;
  for (const nome of conhecidos) {
    const n = semAcento(nome);
    if (n && alvo.includes(n) && (!melhor || n.length > semAcento(melhor).length)) melhor = nome;
  }
  return melhor;
};

const ehInicioDeDocumento = (linha: LinhaDeTextos) =>
  /^(orcamento|pedido|venda|ordem|nota)/.test(semAcento(linha[0] ?? '')) &&
  linha.some((c) => /\*\d+\*/.test(c));

const lerUm = (linhas: LinhaDeTextos[], bairrosConhecidos: string[]): PedidoLido | null => {
  const avisos: string[] = [];

  const cab = linhas.find(ehInicioDeDocumento);
  const cabTexto = cab?.find((c) => /\*\d+\*/.test(c)) ?? '';
  const numero = cabTexto.match(/\*(\d+)\*/)?.[1];
  if (!cab || !numero) return null;

  const razao = campoPorRotulo(linhas, /^razao/)?.replace(/\s*-\s*$/, '') ?? null;
  const fantasia = campoPorRotulo(linhas, /^fantasia/);
  const nome = limpar(fantasia) || limpar(razao);
  if (!nome) return null;

  // "COD:" fica na linha da razão social, e não é o CÓDIGO da tabela de itens.
  const codigo = campoPorRotulo(linhas, /^cod:?$/) ?? null;

  const enderecoTexto = campoPorRotulo(linhas, /^endereco/);
  const { logradouro, numero: numCasa, bairro: bairroDoEndereco } = quebrarEndereco(enderecoTexto);

  const cepLinha = campoPorRotulo(linhas, /^cep$/);
  const cep = cepLinha?.match(/\d{5}-?\d{3}/)?.[0] ?? null;
  const cidade = cepLinha
    ? limpar(cepLinha.replace(/\d{5}-?\d{3}/, '').replace(/^\s*-\s*/, '').replace(/\s+[A-Z]{2}$/, '')) || null
    : null;

  const foneBruto = campoPorRotulo(linhas, /^fone/, true);
  const telefoneTexto = foneBruto ? foneBruto.split(/\/|\s[\w.+-]+@/)[0] : null;
  const digitos = (telefoneTexto ?? '').replace(/\D/g, '');
  const telefone = digitos.length >= 8 ? limpar(telefoneTexto) : null;
  if (!telefone) avisos.push('Sem telefone no pedido.');

  const entregarEm = limpar(campoPorRotulo(linhas, /^entregar em/, true)) || null;

  // O bairro da rota: se o texto de "entregar em" ou o endereço cita um bairro
  // cadastrado, usa esse (é onde o carro vai). Senão, o que o endereço trouxe.
  const bairro =
    bairroConhecidoNoTexto(`${entregarEm ?? ''} ${enderecoTexto ?? ''}`, bairrosConhecidos) ??
    bairroDoEndereco;
  if (!bairro) avisos.push('Sem bairro: esta entrega vai para o fim da rota.');

  // Tabela de itens: começa depois da linha CÓDIGO / QT / MERCADORIA.
  const itens: ItemDoPedido[] = [];
  const cabecalhoItens = linhas.findIndex((l) => {
    const t = l.map(semAcento);
    return t.some((c) => c === 'codigo') && t.some((c) => c === 'qt' || c.startsWith('qtd')) && t.some((c) => c.startsWith('mercadoria'));
  });
  let fimItens = cabecalhoItens + 1;
  if (cabecalhoItens >= 0) {
    for (let i = cabecalhoItens + 1; i < linhas.length; i++) {
      const cel = linhas[i].map(limpar).filter(Boolean);
      // Sem código, a linha tem uma célula a menos; com código, cinco.
      if (cel.length < 4) break;
      const [qt, desc, unit, total] = cel.slice(-4);
      const quantidade = numeroBR(qt);
      if (quantidade === null || !desc) break;
      const m = desc.match(UNIDADES);
      itens.push({
        descricao: m ? limpar(m[2]) : limpar(desc),
        quantidade,
        unidade: m ? m[1].toUpperCase() : undefined,
        valor_unitario: numeroBR(unit) ?? undefined,
        valor_total: numeroBR(total) ?? undefined,
      });
      fimItens = i + 1;
    }
  }
  if (itens.length === 0) avisos.push('Não achei a lista de itens.');

  // Total: o último valor em R$ depois dos itens, sem contar a linha de desconto.
  let valor: number | null = null;
  for (let i = fimItens; i < linhas.length; i++) {
    if (linhas[i].some((c) => /desconto/i.test(c))) continue;
    for (const c of linhas[i]) if (ehDinheiro(c)) valor = numeroBR(c);
  }
  if (valor === null && itens.length > 0) {
    const soma = itens.reduce((s, it) => s + (it.valor_total ?? 0), 0);
    valor = soma > 0 ? Math.round(soma * 100) / 100 : null;
  }

  return {
    documento_tipo: limpar(cab[0]).toUpperCase(),
    documento_numero: numero,
    documento_data: dataISO(cabTexto),
    cliente_codigo: codigo ? limpar(codigo) : null,
    cliente_nome: nome,
    cliente_telefone: telefone,
    endereco_logradouro: logradouro,
    endereco_numero: numCasa,
    bairro,
    cidade,
    cep,
    entregar_em: entregarEm,
    valor,
    itens,
    avisos,
  };
};

/**
 * Lê o documento. Se o arquivo trouxer mais de um pedido (várias vias na
 * mesma folha, ou um PDF com vários), cada cabeçalho "ORÇAMENTO *n*" abre um.
 */
export const lerPedidosDeLinhas = (
  linhasBrutas: LinhaDeTextos[],
  bairrosConhecidos: string[] = []
): PedidoLido[] => {
  const linhas = linhasBrutas.map((l) => l.map(limpar).filter(Boolean)).filter((l) => l.length > 0);
  const inicios = linhas.map((l, i) => (ehInicioDeDocumento(l) ? i : -1)).filter((i) => i >= 0);
  if (inicios.length === 0) return [];

  return inicios
    .map((ini, k) => lerUm(linhas.slice(ini, inicios[k + 1] ?? linhas.length), bairrosConhecidos))
    .filter((p): p is PedidoLido => p !== null);
};
