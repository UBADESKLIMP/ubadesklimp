/**
 * Lê o CSV "Saldo_Estoque" exportado pelo ERP (Estoque > Relatórios > Produtos > Exporta para Excel).
 * Separador ";", decimais com vírgula, codificação Windows-1252. Só pega o que o sistema usa:
 * código, descrição, preço de venda, unidade e saldo. O custo do arquivo é ignorado de propósito.
 */
export interface LinhaErp {
  codpro: string;
  codref: string;
  cod_barras: string;
  descr: string;
  vrvenda: number | null;
  unidade: string;
  saldo: number | null;
  grupo: string;
}

const numero = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = Number(s.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export const lerCsvErp = (texto: string): LinhaErp[] => {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (linhas.length < 2) return [];
  const cab = linhas[0].split(';').map((c) => c.trim().toUpperCase());
  const col = (nome: string) => cab.indexOf(nome);
  const iPro = col('CODPRO');
  const iDescr = col('DESCR');
  if (iPro < 0 || iDescr < 0) return [];
  const iRef = col('CODREF');
  const iBarras = col('COD_BARRAS');
  const iVenda = col('VRVENDA');
  const iUni = col('CODUNI');
  const iSaldo = col('SALDOATU');
  const iGrupo = col('DESCRGRU');

  const saida: LinhaErp[] = [];
  for (let i = 1; i < linhas.length; i++) {
    const c = linhas[i].split(';');
    const codpro = (c[iPro] ?? '').trim();
    const descr = (c[iDescr] ?? '').replace(/\s+/g, ' ').trim();
    if (!codpro || !descr) continue;
    saida.push({
      codpro,
      codref: iRef >= 0 ? (c[iRef] ?? '').trim() : '',
      cod_barras: iBarras >= 0 ? (c[iBarras] ?? '').trim() : '',
      descr,
      vrvenda: iVenda >= 0 ? numero(c[iVenda]) : null,
      unidade: iUni >= 0 ? (c[iUni] ?? '').trim() : '',
      saldo: iSaldo >= 0 ? numero(c[iSaldo]) : null,
      grupo: iGrupo >= 0 ? (c[iGrupo] ?? '').trim() : '',
    });
  }
  return saida;
};

export const lerArquivoErp = async (arquivo: File): Promise<LinhaErp[]> => {
  const buf = await arquivo.arrayBuffer();
  return lerCsvErp(new TextDecoder('windows-1252').decode(buf));
};
