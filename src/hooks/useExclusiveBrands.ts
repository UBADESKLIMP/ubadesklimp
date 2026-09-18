import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ExclusiveBrand {
  id: string;
  supplier_id: string;
  brand: string;
  supplier_company_name: string;
  supplier_contact_name: string;
  supplier_phone: string;
}

export const useExclusiveBrands = () => {
  const [exclusiveBrands, setExclusiveBrands] = useState<ExclusiveBrand[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExclusiveBrands = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_exclusive_brands')
        .select('id, supplier_id, brand, suppliers(company_name, contact_name, phone)')
        .order('brand');
      if (error) throw error;

      const typedRows = (data || []) as unknown as Array<{
        id: string;
        supplier_id: string;
        brand: string;
        suppliers: { company_name: string; contact_name: string; phone: string } | null;
      }>;

      setExclusiveBrands(
        typedRows.map((row) => ({
          id: row.id,
          supplier_id: row.supplier_id,
          brand: row.brand,
          supplier_company_name: row.suppliers?.company_name ?? 'Fornecedor removido',
          supplier_contact_name: row.suppliers?.contact_name ?? '',
          supplier_phone: row.suppliers?.phone ?? '',
        }))
      );
    } catch (error) {
      console.error('Error fetching exclusive brands:', error);
      toast({
        title: 'Erro ao carregar marcas exclusivas',
        description: 'Não foi possível carregar a lista de marcas exclusivas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const brandsForSupplier = (supplierId: string): string[] =>
    exclusiveBrands.filter((row) => row.supplier_id === supplierId).map((row) => row.brand);

  // Substituição completa: apaga o cadastro atual deste fornecedor e de
  // qualquer OUTRO fornecedor que já tivesse alguma dessas marcas (recadastrar
  // uma marca move a exclusividade — nunca duplica, nunca erra por marca já
  // existir noutro fornecedor), depois insere a lista nova.
  const setSupplierBrands = async (supplierId: string, brands: string[]) => {
    try {
      const uniqueBrands = [...new Set(brands.map((b) => b.trim()).filter(Boolean))];

      const { error: deleteOwnError } = await supabase
        .from('supplier_exclusive_brands')
        .delete()
        .eq('supplier_id', supplierId);
      if (deleteOwnError) throw deleteOwnError;

      if (uniqueBrands.length > 0) {
        const { error: deleteOthersError } = await supabase
          .from('supplier_exclusive_brands')
          .delete()
          .in('brand', uniqueBrands);
        if (deleteOthersError) throw deleteOthersError;

        const { error: insertError } = await supabase
          .from('supplier_exclusive_brands')
          .insert(uniqueBrands.map((brand) => ({ supplier_id: supplierId, brand })));
        if (insertError) throw insertError;
      }

      await fetchExclusiveBrands();
    } catch (error) {
      console.error('Error updating supplier exclusive brands:', error);
      toast({
        title: 'Erro ao salvar marcas exclusivas',
        description: 'Não foi possível salvar as mudanças.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchExclusiveBrands();
  }, [fetchExclusiveBrands]);

  return { exclusiveBrands, loading, brandsForSupplier, setSupplierBrands, refetch: fetchExclusiveBrands };
};
