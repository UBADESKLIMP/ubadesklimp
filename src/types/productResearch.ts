export interface ProductResearchSize {
  literage: string;
  image_url: string | null;
}

export interface ProductResearchFragrance {
  name: string;
  image_url: string | null;
}

export interface ProductResearchResult {
  confidence: 'high' | 'low' | 'none';
  name: string | null;
  description: string | null;
  category: string | null;
  material: string | null;
  validity: string | null;
  specifications: string | null;
  brand: string | null;
  action_type: string | null;
  ph_level: string | null;
  application_area: string | null;
  main_image_url: string | null;
  sizes: ProductResearchSize[];
  fragrances: ProductResearchFragrance[];
}
