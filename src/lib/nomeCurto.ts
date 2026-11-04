const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * Palavras que quase todo cliente do mesmo tipo repete. Na tela do motorista,
 * "CONDOMINIO RESIDENCIAL" ocupava a linha inteira e o nome de verdade (o que
 * ele procura) ficava cortado. Abreviadas, o nome distintivo sobe para a vista.
 */
const ABREVIACOES: Record<string, string> = {
  CONDOMINIO: 'COND.',
  RESIDENCIAL: 'RES.',
  EDIFICIO: 'ED.',
  ASSOCIACAO: 'ASSOC.',
  SUPERMERCADO: 'SUPERM.',
  RESTAURANTE: 'REST.',
  DISTRIBUIDORA: 'DISTR.',
  COMERCIAL: 'COM.',
};

const SUFIXOS_LEGAIS = /\s+(LTDA|EPP|ME|EIRELI|S\/A)\.?$/;

/** Só abrevia o que é comprido: "COMERCIAL NOGUEIRA" cabe e fica como está. */
const LIMITE = 22;

export const nomeCurto = (nome: string): string => {
  const limpo = nome.replace(/\s+/g, ' ').trim();
  if (limpo.length <= LIMITE) return limpo;

  const abreviado = limpo
    .split(' ')
    .map((palavra) => ABREVIACOES[semAcento(palavra)] ?? palavra)
    .join(' ')
    .replace(SUFIXOS_LEGAIS, '');

  return abreviado;
};
