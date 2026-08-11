import { ProductWithVariations } from '@/types/product';

// "Produto — Fragrância — Tamanho", omitindo as partes que não existem pro
// item (produto sem variação nenhuma mostra só o nome). "Produto removido"
// quando o product_id não resolve mais (produto excluído do catálogo).
export const buildMissingItemDisplayName = (
  product: ProductWithVariations | undefined,
  fragranceId: string | null,
  variationId: string | null
): string => {
  const fragranceName = product?.fragrances?.find((f) => f.id === fragranceId)?.name;
  const variationLabel = product?.variations?.find((v) => v.id === variationId)?.literage;
  const detailParts = [fragranceName, variationLabel].filter((part): part is string => Boolean(part));
  return detailParts.length > 0
    ? `${product?.name ?? 'Produto removido'} — ${detailParts.join(' — ')}`
    : product?.name || 'Produto removido';
};
