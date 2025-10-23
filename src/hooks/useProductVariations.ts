import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ProductVariation } from '@/types/product';

export const useProductVariations = (productId: string) => {
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchVariations = async () => {
    if (!productId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .select('*')
        .eq('product_id', productId)
        .order('display_order', { ascending: true });

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
      // Buscar maior display_order atual
      const maxOrder = variations.length > 0 
        ? Math.max(...variations.map(v => v.display_order)) 
        : -1;

      const { data, error } = await supabase
        .from('product_variations')
        .insert([{ ...variationData, display_order: maxOrder + 1 }])
        .select()
        .single();

      if (error) throw error;

      setVariations(prev => [...prev, data]);
      toast({
        title: "Variação adicionada",
        description: "A variação foi adicionada com sucesso.",
      });

      return data;
    } catch (error) {
      console.error('Error creating variation:', error);
      toast({
        title: "Erro ao adicionar variação",
        description: "Não foi possível adicionar a variação.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const updateVariation = async (id: string, updates: Partial<ProductVariation>) => {
    try {
      const { data, error } = await supabase
        .from('product_variations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setVariations(prev => prev.map(v => v.id === id ? data : v));
      toast({
        title: "Variação atualizada",
        description: "A variação foi atualizada com sucesso.",
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
        description: "A variação foi removida com sucesso.",
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

  const reorderVariation = async (id: string, direction: 'up' | 'down') => {
    try {
      const currentIndex = variations.findIndex(v => v.id === id);
      if (currentIndex === -1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= variations.length) return;

      const current = variations[currentIndex];
      const target = variations[targetIndex];

      // Trocar display_order
      await Promise.all([
        supabase
          .from('product_variations')
          .update({ display_order: target.display_order })
          .eq('id', current.id),
        supabase
          .from('product_variations')
          .update({ display_order: current.display_order })
          .eq('id', target.id)
      ]);

      await fetchVariations();
      
      toast({
        title: "Ordem atualizada",
        description: "A variação foi reordenada com sucesso.",
      });
    } catch (error) {
      console.error('Error reordering variation:', error);
      toast({
        title: "Erro ao reordenar",
        description: "Não foi possível reordenar a variação.",
        variant: "destructive"
      });
    }
  };

  const setPrimaryVariation = async (id: string) => {
    try {
      console.log('🔧 setPrimaryVariation chamado para ID:', id);
      
      // ATUALIZAÇÃO OTIMISTA: Atualizar estado local primeiro
      setVariations(prev => prev.map(v => ({
        ...v,
        is_primary: v.id === id
      })));

      // Remover is_primary de todas as variações
      const { error: clearError } = await supabase
        .from('product_variations')
        .update({ is_primary: false })
        .eq('product_id', productId);

      if (clearError) throw clearError;

      // Definir a variação selecionada como principal
      const { error } = await supabase
        .from('product_variations')
        .update({ is_primary: true })
        .eq('id', id);

      if (error) throw error;

      console.log('✅ Variação principal atualizada com sucesso no banco');
      
      // Refetch para garantir sincronização
      await fetchVariations();
      
      toast({
        title: "Variação principal definida",
        description: "A variação principal foi atualizada com sucesso.",
      });
    } catch (error) {
      console.error('❌ Error setting primary variation:', error);
      
      // Reverter estado otimista em caso de erro
      await fetchVariations();
      
      toast({
        title: "Erro ao definir principal",
        description: "Não foi possível definir a variação principal.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchVariations();
  }, [productId]);

  return {
    variations,
    loading,
    createVariation,
    updateVariation,
    deleteVariation,
    reorderVariation,
    setPrimaryVariation,
    refetch: fetchVariations
  };
};