
export interface ProductVariation {
  id: string;
  product_id: string;
  literage: string;
  price: number;
  image_url: string | null;
  is_primary: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductFragrance {
  id: string;
  name: string;
  description?: string;
  image_url?: string | null;
  available_literages?: string[]; // Quais litragens estão disponíveis para esta fragrância
  order?: number; // Para ordenação das fragrâncias
}

export interface ProductWithVariations {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  priority: boolean;
  priority_order: number;
  has_variations: boolean;
  has_fragrances?: boolean;
  highlight_type?: 'bestseller' | 'promotion' | 'new' | 'featured' | 'none' | null;
  material?: string;
  validity?: string;
  specifications?: string;
  fragrances?: ProductFragrance[];
  created_at: string;
  updated_at: string;
  variations: ProductVariation[];
  // Para produtos sem variações, usamos o preço base
  price?: number;
  size_unit?: 'litros' | 'cm' | 'ml' | 'kg' | 'g' | 'unidades';
  price_position?: 'below_image' | 'below_text';
  // Campos automotivos
  action_type?: string | null;
  ph_level?: string | null;
  application_area?: string | null;
  brand?: string | null;
  // Linha do produto (automotivo ou limpeza)
  line_type?: 'limpeza' | 'automotivo';
  out_of_stock?: boolean;
  literage_single?: string;
  // Se falso, some do site público mas continua disponível no admin
  is_public?: boolean;
}
