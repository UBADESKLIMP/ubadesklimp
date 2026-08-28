import * as XLSX from 'xlsx';

export interface QuoteExcelRow {
  id: string;
  displayName: string;
}

const HEADER_ROW = ['Item', 'Preço (R$)', 'Adendo', 'ID (não editar)'];

// Coluna D (índice 3, base 0) fica escondida — só serve pra casar cada
// linha de volta com o item certo na importação, sem depender de casar
// pelo texto do nome (que pode ter sido editado/reformatado pelo
// fornecedor ao preencher a planilha).
export const buildQuoteRequestExcel = (items: QuoteExcelRow[], batchLabel: string): void => {
  const rows = [HEADER_ROW, ...items.map((item) => [item.displayName, '', '', item.id])];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 30 }, { wch: 10, hidden: true }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Cotação');
  XLSX.writeFile(workbook, `cotacao-${batchLabel}.xlsx`);
};

export interface QuoteExcelImportRow {
  itemId: string;
  price: number | null;
  note: string | null;
}

// Célula de preço pode vir como número (Excel já reconhece "13,90" digitado
// numa célula numérica e guarda como número puro) ou como texto (célula
// formatada como texto) — nesse segundo caso troca vírgula por ponto antes
// de converter.
const parsePrice = (value: unknown): number | null => {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const cleaned = trimmed.replace(/[^\d.,-]/g, '');
    const canonical = cleaned.includes(',')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned;
    const parsed = parseFloat(canonical);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

export const parseQuoteRequestExcel = (file: File): Promise<QuoteExcelImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error('Arquivo vazio.'));
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        const dataRows = rows.slice(1); // pula a linha de cabeçalho

        const parsed: QuoteExcelImportRow[] = [];
        for (const row of dataRows) {
          const itemId = row[3];
          if (typeof itemId !== 'string' || itemId.trim() === '') continue;
          parsed.push({
            itemId: itemId.trim(),
            price: parsePrice(row[1]),
            note: typeof row[2] === 'string' && row[2].trim() !== '' ? row[2].trim() : null,
          });
        }
        resolve(parsed);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Não foi possível ler a planilha.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
};
