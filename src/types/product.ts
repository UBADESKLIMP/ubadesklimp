
export interface ProductVariation {
  id: string;
  product_id: string;
  literage: string;
  price: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductFragrance {
  id: string;
  name: string;
  description?: string;
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
}
