
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
  priority_order: number;
  has_variations: boolean;
  material?: string;
  validity?: string;
  specifications?: string;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<ProductWithVariations[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Buscar produtos com suas variações
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('priority', { ascending: false })
        .order('priority_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Buscar todas as variações
      const { data: variationsData, error: variationsError } = await supabase
        .from('product_variations')
        .select('*');

      if (variationsError) throw variationsError;

      // Combinar produtos com suas variações
      const productsWithVariations: ProductWithVariations[] = (productsData || []).map(product => ({
        ...product,
        variations: (variationsData || []).filter(variation => variation.product_id === product.id)
      }));

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
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
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
      const { data, error } = await supabase
        .from('products')
        .update(productData)
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
