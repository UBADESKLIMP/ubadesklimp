import { normalizeText } from '@/lib/utils';
import type { StaffPermission } from '@/hooks/useStaffAccess';

/**
 * Função é o que a pessoa faz na loja. É etiqueta, não permissão.
 *
 * A diferença importa: se a função mandasse no que a pessoa enxerga, o dia em
 * que alguém for entregador *e* caixa viraria invenção de combinação, e
 * renomear uma função mudaria calado quem vê o quê. Então ela só sugere as
 * caixas na hora de escolher, e quem cadastra corrige o que quiser.
 *
 * A lista começa com as funções da loja e cresce sozinha: o que for digitado
 * uma vez passa a ser oferecido para o próximo.
 */
export const FUNCOES_SUGERIDAS = [
  'Atendente de caixa',
  'Estoquista',
  'Entregador',
  'Gestor de loja',
  'Escritório',
];

const PERMISSOES_POR_FUNCAO: Record<string, StaffPermission[]> = {
  'atendente de caixa': ['faltantes'],
  estoquista: ['faltantes', 'produtos'],
  // Quem entrega não abre o painel: entra em /entregas pelo PIN, como no ponto.
  entregador: [],
  'gestor de loja': ['faltantes', 'produtos', 'fornecedores', 'financeiro'],
  escritorio: ['financeiro'],
};

export const permissoesSugeridas = (funcao: string): StaffPermission[] | null => {
  if (!funcao.trim()) return null;
  return PERMISSOES_POR_FUNCAO[normalizeText(funcao.trim())] ?? null;
};

/**
 * "entregador", "Entregador" e "Entregadôr " são a mesma função. Sem juntar na
 * entrada, a lista enche de quase-duplicatas e deixa de servir para filtrar.
 */
export const normalizarFuncao = (bruto: string, conhecidas: string[]): string => {
  const limpo = bruto.trim().replace(/\s+/g, ' ');
  if (!limpo) return '';
  const alvo = normalizeText(limpo);
  const jaUsada = conhecidas.find((c) => normalizeText(c) === alvo);
  if (jaUsada) return jaUsada;
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
};

/** As sugeridas mais as que já estão em uso, sem repetir, em ordem. */
export const funcoesConhecidas = (emUso: (string | null)[]): string[] => {
  const vistas = new Map<string, string>();
  [...FUNCOES_SUGERIDAS, ...emUso].forEach((f) => {
    const nome = (f ?? '').trim();
    if (!nome) return;
    const chave = normalizeText(nome);
    if (!vistas.has(chave)) vistas.set(chave, nome);
  });
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
};
