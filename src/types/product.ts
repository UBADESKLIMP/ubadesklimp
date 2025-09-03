
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
  image_url?: string | null;
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
  // Define qual variação controla a troca de imagem: 'fragrance', 'volume', ou 'none'
  image_controlled_by?: 'fragrance' | 'volume' | 'none';
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
