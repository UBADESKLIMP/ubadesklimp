export type UnidadeCompra = 'unidade' | 'caixa';

/**
 * Como a loja compra por padrão: caixa.
 *
 * Era unidade, e a unidade vinha de uma leitura da observação do fornecedor
 * ("CXA 1X6", "caixa c/12") pra sugerir caixa quando o texto dizia. Na prática
 * a loja reabastece em caixa quase sempre, e o padrão errado custava um toque
 * por item na hora de fechar o pedido — item nenhum some por isso, mas o
 * trabalho repetido some.
 *
 * Caixa como padrão engloba o que aquela leitura fazia: ela só sabia apontar
 * caixa, nunca o contrário. O que ficou de fora continua fora — "FD" (fardo) e
 * "Pack" também são volume e não são caixa, e o sistema só tem unidade/caixa.
 *
 * O que já foi decidido vence o padrão: quem marcou "un" num item não vê a
 * marca voltar pra cx sozinha.
 */
export const PADRAO_UNIDADE_COMPRA: UnidadeCompra = 'caixa';

export const unidadeSugerida = (
  gravada: UnidadeCompra | null | undefined
): UnidadeCompra => gravada ?? PADRAO_UNIDADE_COMPRA;
