import { Tables } from '@/integrations/supabase/types';

export type ProductRow = Omit<
  Tables<'products'>,
  'line_type' | 'size_unit' | 'price_position' | 'highlight_type'
> & {
  line_type: 'limpeza' | 'automotivo' | null;
  size_unit: 'litros' | 'cm' | 'ml' | 'kg' | 'g' | 'unidades' | null;
  price_position: 'below_image' | 'below_text' | null;
  highlight_type: 'bestseller' | 'promotion' | 'new' | 'featured' | 'none' | null;
};

export type ProductVariation = Tables<'product_variations'>;

export interface ProductFragrance {
  id: string;
  name: string;
  description?: string;
  image_url?: string | null;
  available_literages?: string[]; // Quais litragens estão disponíveis para esta fragrância
  order?: number; // Para ordenação das fragrâncias (mapeado de order_index no banco)
}

export interface ProductWithVariations extends ProductRow {
  fragrances?: ProductFragrance[];
  variations: ProductVariation[];
}
