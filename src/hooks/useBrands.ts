import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useBrands = () => {
  const [brands, setBrands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('brand')
        .eq('line_type', 'automotivo')
        .not('brand', 'is', null);

      if (error) throw error;

      // Extract unique brands
      const uniqueBrands = [...new Set(data?.map(p => p.brand).filter(Boolean))] as string[];
      setBrands(uniqueBrands.sort());
    } catch (error) {
      console.error('Error fetching brands:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return { brands, loading, refetch: fetchBrands };
};
