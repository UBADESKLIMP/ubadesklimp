
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ProductWithVariations } from '@/types/product';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  priority: boolean;
  highlight_type?: 'bestseller' | 'promotion' | 'new' | 'featured' | 'none' | null;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<ProductWithVariations[]>([]);
  const [loading, setLoading] = useState(true);

  // Sanitize payload to only include columns that exist in 'products' table
  const sanitizeProductPayload = (data: any) => {
    if (!data) return {};
    const allowedKeys = [
      'name',
      'description',
      'price',
      'category',
      'image_url',
      'priority',
      'priority_order',
      'has_variations',
      'highlight_type',
      'material',
      'validity',
      'specifications'
    ];
    const payload: Record<string, any> = {};
    for (const key of allowedKeys) {
      if (key in data) payload[key] = (data as any)[key];
    }
    return payload;
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Buscar produtos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('priority', { ascending: false })
        .order('priority_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Para cada produto, buscar suas variações se houver
      const productsWithVariations: ProductWithVariations[] = await Promise.all(
        (productsData || []).map(async (product) => {
          let variations: any[] = [];
          
          if (product.has_variations) {
            const { data: variationsData, error: variationsError } = await supabase
              .from('product_variations')
              .select('*')
              .eq('product_id', product.id)
              .order('created_at', { ascending: true });
            
            if (!variationsError) {
              variations = variationsData || [];
            }
          }

          // Carregar fragrâncias do localStorage
          let fragrances: any[] = [];
          try {
            const storedFragrances = localStorage.getItem(`fragrances_${product.id}`);
            if (storedFragrances) {
              fragrances = JSON.parse(storedFragrances);
            }
          } catch (error) {
            console.error('Error loading fragrances from localStorage:', error);
          }

          return {
            id: product.id,
            name: product.name,
            description: product.description,
            category: product.category,
            image_url: product.image_url,
            priority: product.priority,
            priority_order: product.priority_order || 0,
            has_variations: product.has_variations || false,
            has_fragrances: fragrances.length > 0,
            highlight_type: (product as any).highlight_type || null,
            material: product.material,
            validity: product.validity,
            specifications: product.specifications,
            created_at: product.created_at,
            updated_at: product.updated_at,
            variations: variations,
            fragrances: fragrances,
            price: product.price
          };
        })
      );

      setProducts(productsWithVariations);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: "Não foi possível carregar os produtos.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const payload = sanitizeProductPayload(productData) as any;
      const { data, error } = await supabase
        .from('products')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      await fetchProducts();
      toast({
        title: "Produto criado",
        description: "Produto adicionado com sucesso.",
      });
      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: "Erro ao criar produto",
        description: "Não foi possível criar o produto.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateProduct = async (id: string, productData: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const payload = sanitizeProductPayload(productData) as any;
      const { data, error } = await supabase
        .from('products')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await fetchProducts();
      toast({
        title: "Produto atualizado",
        description: "Produto atualizado com sucesso.",
      });
      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: "Erro ao atualizar produto",
        description: "Não foi possível atualizar o produto.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProducts(prev => prev.filter(p => p.id !== id));
      toast({
        title: "Produto removido",
        description: "Produto removido com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Erro ao remover produto",
        description: "Não foi possível remover o produto.",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    loading,
    createProduct,
    updateProduct,
    deleteProduct,
    refetch: fetchProducts
  };
};
