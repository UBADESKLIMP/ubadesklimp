import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProductRow } from '@/types/product';

export type PriorityProduct = Pick<
  ProductRow,
  'id' | 'name' | 'image_url' | 'priority_order' | 'highlight_type' | 'line_type' | 'category' | 'price'
>;

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

      setPriorityProducts((data || []) as PriorityProduct[]);
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

  // Batch update for drag & drop reordering
  const batchUpdateOrder = async (updates: { id: string; order: number }[]) => {
    try {
      // Update all items in parallel
      await Promise.all(
        updates.map(({ id, order }) =>
          supabase
            .from('products')
            .update({ priority_order: order })
            .eq('id', id)
        )
      );

      await fetchPriorityProducts();
    } catch (error) {
      console.error('Error in batch update:', error);
      throw error;
    }
  };

  const getOccupiedPositions = (excludeProductId?: string): number[] => {
    return priorityProducts
      .filter(p => p.id !== excludeProductId)
      .map(p => p.priority_order ?? 0);
  };

  // Get next available position (for adding new priority products at the end)
  const getNextAvailablePosition = (lineType?: 'limpeza' | 'automotivo'): number => {
    const filtered = lineType
      ? priorityProducts.filter(p => p.line_type === lineType)
      : priorityProducts;

    if (filtered.length === 0) return 1;

    const maxOrder = Math.max(...filtered.map(p => p.priority_order ?? 0));
    return Math.min(maxOrder + 1, 10);
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
    batchUpdateOrder,
    getOccupiedPositions,
    getNextAvailablePosition,
  };
};
