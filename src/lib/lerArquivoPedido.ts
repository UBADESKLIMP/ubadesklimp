import * as XLSX from 'xlsx';
import type { LinhaDeTextos } from './pedidoErp';

/** Agrupa os textos de uma página de PDF em linhas (mesma altura) e ordena da esquerda para a direita. */
const linhasDoPdf = async (buffer: ArrayBuffer): Promise<LinhaDeTextos[]> => {
  // Carregado só quando alguém sobe um PDF: é uma biblioteca grande e a maior
  // parte do uso é planilha.
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const todas: LinhaDeTextos[] = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const conteudo = await (await pdf.getPage(n)).getTextContent();
    const textos = conteudo.items
      .filter((i): i is typeof i & { str: string; transform: number[] } => 'str' in i && i.str.trim() !== '')
      .map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5] }))
      .sort((a, b) => b.y - a.y || a.x - b.x);

    const linhas: { y: number; cel: { s: string; x: number }[] }[] = [];
    for (const t of textos) {
      const ultima = linhas[linhas.length - 1];
      if (ultima && Math.abs(ultima.y - t.y) <= 3) ultima.cel.push(t);
      else linhas.push({ y: t.y, cel: [t] });
    }
    linhas.forEach((l) => todas.push(l.cel.sort((a, b) => a.x - b.x).map((c) => c.s)));
  }
  return todas;
};

const linhasDaPlanilha = async (buffer: ArrayBuffer): Promise<LinhaDeTextos[]> => {
  const wb = XLSX.read(buffer, { type: 'array' });
  const todas: LinhaDeTextos[] = [];
  wb.SheetNames.forEach((nome) => {
    // raw:false traz o texto como aparece na célula ("1,00", "R$424,49"), que
    // é o que a leitura espera, e não o número cru do Excel.
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, blankrows: false }) as unknown[][];
    linhas.forEach((l) => todas.push(Array.from(l, (c) => (c == null ? '' : String(c)))));
  });
  return todas;
};

/** Pedido do ERP em PDF ou planilha, como linhas de textos prontas para `lerPedidosDeLinhas`. */
export const linhasDoArquivo = async (arquivo: File): Promise<LinhaDeTextos[]> => {
  const nome = arquivo.name.toLowerCase();
  const buffer = await arquivo.arrayBuffer();
  if (nome.endsWith('.pdf')) return linhasDoPdf(buffer);
  if (/\.(xlsx|xls|csv)$/.test(nome)) return linhasDaPlanilha(buffer);
  throw new Error('Tipo de arquivo não aceito. Use PDF ou planilha (.xlsx, .xls, .csv).');
};
