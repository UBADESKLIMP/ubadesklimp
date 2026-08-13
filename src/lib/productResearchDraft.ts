import { ProductWithVariations } from '@/types/product';
import { ProductResearchResult, ProductResearchSize, ProductResearchFragrance } from '@/types/productResearch';

export interface ProductAiSuggestions {
  confidence: 'high' | 'low' | 'none';
  mainImageUrl: string | null;
  sizes: ProductResearchSize[];
  fragrances: ProductResearchFragrance[];
}

// Infere a unidade de medida a partir da string de tamanho devolvida pela IA
// (ex: "500ml", "5L", "1kg", "30cm"). Checa os sufixos mais específicos antes
// dos mais curtos que os contêm (ml antes de l, kg antes de g), senão "500ml"
// bateria incorretamente no teste de litros. Sem sufixo reconhecido, cai em
// 'unidades' (ex: "8 Rolos", "2 unidades").
export const inferSizeUnit = (
  literage: string
): 'litros' | 'cm' | 'ml' | 'kg' | 'g' | 'unidades' => {
  const normalized = literage.trim().toLowerCase().replace(/\s+/g, '');
  if (/ml$/.test(normalized)) return 'ml';
  if (/(^|[0-9])l$/.test(normalized)) return 'litros';
  if (/kg$/.test(normalized)) return 'kg';
  if (/g$/.test(normalized)) return 'g';
  if (/cm$/.test(normalized)) return 'cm';
  return 'unidades';
};

// Fase 1: só os campos editáveis antes do produto existir (nome, descrição,
// categoria, campos técnicos, tamanho único quando só há 1). Tamanhos
// múltiplos e fragrâncias não entram aqui — ver buildAiSuggestions, que
// alimenta a Fase 2 (depois que o produto já tem id).
export const buildProductDraft = (
  result: ProductResearchResult,
  typedName: string,
  lineType: 'limpeza' | 'automotivo'
): Partial<ProductWithVariations> => {
  const hasMultipleSizes = result.sizes.length >= 2;
  const singleSize = result.sizes.length === 1 ? result.sizes[0] : null;

  return {
    name: result.name || typedName,
    description: result.description || '',
    category: result.category || '',
    line_type: lineType,
    has_variations: hasMultipleSizes,
    literage_single: singleSize?.literage || '',
    ...(singleSize ? { size_unit: inferSizeUnit(singleSize.literage) } : {}),
    material: result.material || '',
    validity: result.validity || '',
    specifications: result.specifications || '',
    brand: result.brand || '',
    action_type: result.action_type || '',
    ph_level: result.ph_level || '',
    application_area: result.application_area || '',
  };
};

// Fase 2: sugestões que só ficam disponíveis depois que o produto tem id
// (aba Variações). Tamanho único já virou literage_single na Fase 1, então
// só entra em "sizes" aqui quando há 2 ou mais.
export const buildAiSuggestions = (result: ProductResearchResult): ProductAiSuggestions => ({
  confidence: result.confidence,
  mainImageUrl: result.main_image_url,
  sizes: result.sizes.length >= 2 ? result.sizes : [],
  fragrances: result.fragrances,
});
