import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { ProductFragrance } from '@/types/product';
import { supabase } from '@/integrations/supabase/client';

export const useProductFragrances = (productId: string) => {
  const [fragrances, setFragrances] = useState<ProductFragrance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFragrances = async () => {
    if (!productId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_fragrances')
        .select('*')
        .eq('product_id', productId)
        .order('order_index', { ascending: true });

      if (error) throw error;

      // Converter para o formato esperado
      const mappedFragrances: ProductFragrance[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || undefined,
        image_url: item.image_url || undefined,
        available_literages: item.available_literages || [],
        order: item.order_index
      }));

      setFragrances(mappedFragrances);
    } catch (error) {
      console.error('Error fetching fragrances:', error);
      setFragrances([]);
    } finally {
      setLoading(false);
    }
  };

  const saveFragrances = async (newFragrances: ProductFragrance[]) => {
    if (!productId) return;

    try {
      // Primeiro, deletar todas as fragrâncias existentes para este produto
      await supabase
        .from('product_fragrances')
        .delete()
        .eq('product_id', productId);

      // Depois, inserir as novas fragrâncias
      if (newFragrances.length > 0) {
        const fragrancesToInsert = newFragrances.map(fragrance => ({
          product_id: productId,
          name: fragrance.name,
          description: fragrance.description || null,
          image_url: fragrance.image_url || null,
          available_literages: fragrance.available_literages || [],
          order_index: fragrance.order || 0
        }));

        const { error: insertError } = await supabase
          .from('product_fragrances')
          .insert(fragrancesToInsert);

        if (insertError) throw insertError;
      }

      // Atualizar o campo has_fragrances do produto
      await supabase
        .from('products')
        .update({ has_fragrances: newFragrances.length > 0 })
        .eq('id', productId);

      setFragrances(newFragrances);
      
      toast({
        title: "Fragrâncias salvas",
        description: "As fragrâncias foram salvas com sucesso.",
      });
    } catch (error) {
      console.error('Error saving fragrances:', error);
      toast({
        title: "Erro ao salvar fragrâncias",
        description: "Não foi possível salvar as fragrâncias.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchFragrances();
  }, [productId]);

  return {
    fragrances,
    loading,
    saveFragrances,
    refetch: fetchFragrances
  };
};