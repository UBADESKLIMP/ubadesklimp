
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
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<ProductWithVariations[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Buscar produtos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Mapear produtos com todas as propriedades necessárias
      const productsWithVariations: ProductWithVariations[] = (productsData || []).map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        image_url: product.image_url,
        priority: product.priority,
        priority_order: 0, // Valor padrão já que não existe na tabela ainda
        has_variations: false, // Temporariamente false até implementarmos variações
        material: undefined, // Não existe na tabela ainda
        validity: undefined, // Não existe na tabela ainda
        specifications: undefined, // Não existe na tabela ainda
        created_at: product.created_at,
        updated_at: product.updated_at,
        variations: [], // Array vazio temporariamente
        price: product.price // Preço obrigatório por enquanto
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
