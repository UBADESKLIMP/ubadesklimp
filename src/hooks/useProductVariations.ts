
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ProductVariation } from '@/types/product';

export const useProductVariations = (productId?: string) => {
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVariations = async (id: string) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', id)
        .order('created_at');

      if (error) throw error;
      setVariations(data || []);
    } catch (error) {
      console.error('Error fetching variations:', error);
      toast({
        title: "Erro ao carregar variações",
        description: "Não foi possível carregar as variações do produto.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createVariation = async (variationData: Omit<ProductVariation, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .insert([variationData])
        .select()
        .single();

      if (error) throw error;

      setVariations(prev => [...prev, data]);
      toast({
        title: "Variação criada",
        description: "Variação adicionada com sucesso.",
      });
      return data;
    } catch (error) {
      console.error('Error creating variation:', error);
      toast({
        title: "Erro ao criar variação",
        description: "Não foi possível criar a variação.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateVariation = async (id: string, variationData: Partial<Omit<ProductVariation, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .update(variationData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setVariations(prev => prev.map(v => v.id === id ? data : v));
      toast({
        title: "Variação atualizada",
        description: "Variação atualizada com sucesso.",
      });
      return data;
    } catch (error) {
      console.error('Error updating variation:', error);
      toast({
        title: "Erro ao atualizar variação",
        description: "Não foi possível atualizar a variação.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const deleteVariation = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_variations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setVariations(prev => prev.filter(v => v.id !== id));
      toast({
        title: "Variação removida",
        description: "Variação removida com sucesso.",
      });
    } catch (error) {
      console.error('Error deleting variation:', error);
      toast({
        title: "Erro ao remover variação",
        description: "Não foi possível remover a variação.",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    if (productId) {
      fetchVariations(productId);
    }
  }, [productId]);

  return {
    variations,
    loading,
    createVariation,
    updateVariation,
    deleteVariation,
    refetch: () => productId && fetchVariations(productId)
  };
};
