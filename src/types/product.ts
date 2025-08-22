
export interface ProductVariation {
  id: string;
  literage: string;
  price: number;
}

export interface ProductWithVariations {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  priority: boolean;
  created_at: string;
  updated_at: string;
  variations: ProductVariation[];
  // Campos para especificações
  material?: string;
  validity?: string;
  specifications?: string;
}
