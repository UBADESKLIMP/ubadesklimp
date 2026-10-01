export type UnidadeCompra = 'unidade' | 'caixa';

/**
 * Lê a observação que o fornecedor mandou junto do preço e diz se ela indica
 * compra por caixa.
 *
 * Os padrões saíram das observações reais das cotações, não de suposição:
 * "CXA 1X6", "CXA 10X10", "Amable, CXA 1X12" (o CXA pode vir depois de outra
 * informação), "Maxi caixa c/12". Fica de fora o que não diz nada sobre
 * embalagem de compra — "3L", "500ml", "6500K Bivolt", "Ourolux", "Ref 3796".
 *
 * "FD" (fardo) e "Pack" também são compra em volume, mas não são caixa e o
 * sistema só tem unidade/caixa — ficam de fora de propósito, pra sugestão
 * errada não passar batida. Quem decide é a pessoa.
 */
export const observacaoIndicaCaixa = (observacao: string | null | undefined): boolean => {
  if (!observacao) return false;

  const texto = observacao
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  // "cxa 1x6", "cx 12", "caixa c/12" — sempre como palavra inteira, pra não
  // casar com pedaço de outra palavra.
  return /\b(cxa?|caixas?)\b/.test(texto);
};

/**
 * O que mostrar marcado: o que já foi decidido vence; sem decisão, a
 * observação sugere.
 */
export const unidadeSugerida = (
  gravada: UnidadeCompra | null | undefined,
  observacao: string | null | undefined
): UnidadeCompra => {
  if (gravada) return gravada;
  return observacaoIndicaCaixa(observacao) ? 'caixa' : 'unidade';
};
