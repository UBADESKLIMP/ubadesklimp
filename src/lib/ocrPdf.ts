import type { LinhaDeTextos } from './pedidoErp';

/**
 * PDF impresso por impressora PostScript (ex.: "Imprimir -> PDF"): o arquivo não
 * guarda quais letras são, só o desenho delas. O texto chega como códigos de
 * controle, então a única saída é ler a imagem da página (OCR).
 */
// eslint-disable-next-line no-control-regex
export const textoIlegivel = (textos: string[]) => textos.some((t) => /[\x01-\x08\x0e-\x1f]/.test(t));

interface PalavraOcr {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/**
 * Palavras da mesma linha viram células separadas quando o vão entre elas é
 * maior que um espaço normal: é assim que "QT", "MERCADORIA" e os valores ficam
 * em colunas, como no PDF que tem texto de verdade.
 */
export const celulasDaLinha = (palavras: PalavraOcr[]): string[] => {
  const ordenadas = [...palavras].filter((p) => p.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
  const celulas: string[] = [];
  let atual: string[] = [];
  ordenadas.forEach((p, i) => {
    const anterior = ordenadas[i - 1];
    const altura = Math.max(p.bbox.y1 - p.bbox.y0, 1);
    if (anterior && p.bbox.x0 - anterior.bbox.x1 > altura * 1.1) {
      celulas.push(atual.join(' '));
      atual = [];
    }
    atual.push(p.text.trim());
  });
  if (atual.length > 0) celulas.push(atual.join(' '));
  return celulas;
};

/** Desenha a página e lê com OCR em português. Devolve as linhas de cima para baixo. */
export const linhasPorOcr = async (
  paginas: { render: (escala: number) => Promise<HTMLCanvasElement> }[]
): Promise<LinhaDeTextos[]> => {
  const { createWorker } = await import('tesseract.js');
  // O idioma e o motor são baixados na primeira vez e ficam guardados no navegador.
  const worker = await createWorker('por');
  const todas: LinhaDeTextos[] = [];
  try {
    for (const pagina of paginas) {
      const canvas = await pagina.render(3);
      const { data } = await worker.recognize(canvas, {}, { blocks: true });
      const linhas = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
      linhas
        .sort((a, b) => a.bbox.y0 - b.bbox.y0)
        .forEach((l) => {
          const celulas = celulasDaLinha(l.words);
          if (celulas.length > 0) todas.push(celulas);
        });
    }
  } finally {
    await worker.terminate();
  }
  return todas;
};
