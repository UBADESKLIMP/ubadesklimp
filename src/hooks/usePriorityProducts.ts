import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PriorityProduct {
  id: string;
  name: string;
  image_url: string | null;
  priority_order: number;
  highlight_type: string | null;
  line_type: string | null;
  category: string;
  price: number;
}

export const usePriorityProducts = (lineTypeFilter?: 'limpeza' | 'automotivo' | 'all') => {
  const [priorityProducts, setPriorityProducts] = useState<PriorityProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPriorityProducts = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select('id, name, image_url, priority_order, highlight_type, line_type, category, price')
        .eq('priority', true)
        .order('priority_order', { ascending: true });

      if (lineTypeFilter && lineTypeFilter !== 'all') {
        query = query.eq('line_type', lineTypeFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching priority products:', error);
        return;
      }

      setPriorityProducts(data || []);
    } catch (error) {
      console.error('Error in fetchPriorityProducts:', error);
    } finally {
      setLoading(false);
    }
  }, [lineTypeFilter]);

  useEffect(() => {
    fetchPriorityProducts();
  }, [fetchPriorityProducts]);

  const getProductByPosition = (position: number): PriorityProduct | undefined => {
    return priorityProducts.find(p => p.priority_order === position);
  };

  const isPositionOccupied = (position: number, excludeProductId?: string): boolean => {
    return priorityProducts.some(
      p => p.priority_order === position && p.id !== excludeProductId
    );
  };

  const getPositionStatus = (position: number, excludeProductId?: string) => {
    const product = priorityProducts.find(
      p => p.priority_order === position && p.id !== excludeProductId
    );
    return {
      occupied: !!product,
      product,
    };
  };

  const removePriority = async (productId: string) => {
    const { error } = await supabase
      .from('products')
      .update({ priority: false, priority_order: 0, highlight_type: null })
      .eq('id', productId);

    if (error) {
      console.error('Error removing priority:', error);
      throw error;
    }

    await fetchPriorityProducts();
  };

  const updatePriorityOrder = async (productId: string, newOrder: number) => {
    const { error } = await supabase
      .from('products')
      .update({ priority_order: newOrder })
      .eq('id', productId);

    if (error) {
      console.error('Error updating priority order:', error);
      throw error;
    }

    await fetchPriorityProducts();
  };

  const getOccupiedPositions = (excludeProductId?: string): number[] => {
    return priorityProducts
      .filter(p => p.id !== excludeProductId)
      .map(p => p.priority_order);
  };

  return {
    priorityProducts,
    loading,
    refetch: fetchPriorityProducts,
    getProductByPosition,
    isPositionOccupied,
    getPositionStatus,
    removePriority,
    updatePriorityOrder,
    getOccupiedPositions,
  };
};
