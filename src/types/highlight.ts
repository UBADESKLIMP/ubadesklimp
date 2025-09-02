export type HighlightType = 'bestseller' | 'promotion' | 'new' | 'featured';

export interface HighlightConfig {
  type: HighlightType;
  label: string;
  gradient: string;
  shadowColor: string;
  iconColor: string;
}

export const HIGHLIGHT_CONFIGS: Record<HighlightType, HighlightConfig> = {
  bestseller: {
    type: 'bestseller',
    label: 'Mais Vendido',
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    shadowColor: 'shadow-amber-400/40',
    iconColor: 'text-white'
  },
  promotion: {
    type: 'promotion',
    label: 'Promoção',
    gradient: 'from-red-500 via-pink-500 to-rose-500',
    shadowColor: 'shadow-red-400/40',
    iconColor: 'text-white'
  },
  new: {
    type: 'new',
    label: 'Novidade',
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    shadowColor: 'shadow-emerald-400/40',
    iconColor: 'text-white'
  },
  featured: {
    type: 'featured',
    label: 'Destaque',
    gradient: 'from-purple-500 via-violet-500 to-indigo-500',
    shadowColor: 'shadow-purple-400/40',
    iconColor: 'text-white'
  }
};

// Função para determinar o tipo de destaque baseado na categoria (temporário)
export const getHighlightTypeByCategory = (category: string): HighlightType => {
  const categoryLower = category.toLowerCase();
  
  if (categoryLower.includes('detergente') || categoryLower.includes('sabão')) {
    return 'bestseller';
  }
  if (categoryLower.includes('desinfetante') || categoryLower.includes('álcool')) {
    return 'promotion';
  }
  if (categoryLower.includes('amaciante') || categoryLower.includes('perfume')) {
    return 'new';
  }
  
  return 'featured';
};