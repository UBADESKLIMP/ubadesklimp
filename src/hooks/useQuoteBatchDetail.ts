import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface QuoteBatchDetailItem {
  id: string;
  missing_product_id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  quantity: number;
}

export interface QuoteBatchDetailSupplier {
  id: string;
  supplier_id: string;
  company_name: string;
  contact_name: string;
  status: 'pendente' | 'revisado';
  filled_count: number;
}

export interface QuoteBatchDetail {
  id: string;
  status: 'aberto' | 'cancelado' | 'concluido';
  created_by_name: string;
  created_at: string;
}

export const useQuoteBatchDetail = (batchId: string) => {
  const [batch, setBatch] = useState<QuoteBatchDetail | null>(null);
  const [items, setItems] = useState<QuoteBatchDetailItem[]>([]);
  const [suppliers, setSuppliers] = useState<QuoteBatchDetailSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const { data: batchRow, error: batchError } = await supabase
        .from('quote_batches')
        .select('id, status, created_by_name, created_at')
        .eq('id', batchId)
        .single();
      if (batchError) throw batchError;
      setBatch(batchRow as QuoteBatchDetail);

      const { data: itemRows, error: itemsError } = await supabase
        .from('quote_batch_items')
        .select('id, missing_product_id, quantity, missing_products(product_id, fragrance_id, variation_id, stock_remaining)')
        .eq('quote_batch_id', batchId);
      if (itemsError) throw itemsError;

      const typedItemRows = (itemRows || []) as unknown as Array<{
        id: string;
        missing_product_id: string;
        quantity: number;
        missing_products: {
          product_id: string;
          fragrance_id: string | null;
          variation_id: string | null;
          stock_remaining: number | null;
        } | null;
      }>;

      setItems(
        typedItemRows.map((row) => ({
          id: row.id,
          missing_product_id: row.missing_product_id,
          product_id: row.missing_products?.product_id ?? '',
          fragrance_id: row.missing_products?.fragrance_id ?? null,
          variation_id: row.missing_products?.variation_id ?? null,
          stock_remaining: row.missing_products?.stock_remaining ?? null,
          quantity: row.quantity,
        }))
      );

      const { data: supplierRows, error: suppliersError } = await supabase
        .from('quote_batch_suppliers')
        .select('id, supplier_id, status, suppliers(company_name, contact_name), quote_line_items(price)')
        .eq('quote_batch_id', batchId);
      if (suppliersError) throw suppliersError;

      const typedSupplierRows = (supplierRows || []) as unknown as Array<{
        id: string;
        supplier_id: string;
        status: 'pendente' | 'revisado';
        suppliers: { company_name: string; contact_name: string } | null;
        quote_line_items: { price: number | null }[];
      }>;

      setSuppliers(
        typedSupplierRows.map((row) => ({
          id: row.id,
          supplier_id: row.supplier_id,
          company_name: row.suppliers?.company_name ?? 'Fornecedor removido',
          contact_name: row.suppliers?.contact_name ?? '',
          status: row.status,
          filled_count: row.quote_line_items.filter((li) => li.price !== null).length,
        }))
      );
    } catch (error) {
      console.error('Error fetching quote batch detail:', error);
      toast({
        title: 'Erro ao carregar o lote',
        description: 'Não foi possível carregar os detalhes desta cotação.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const cancelBatch = async () => {
    try {
      const { error } = await supabase.from('quote_batches').update({ status: 'cancelado' }).eq('id', batchId);
      if (error) throw error;
      toast({ title: 'Cotação cancelada' });
      await fetchDetail();
    } catch (error) {
      console.error('Error cancelling quote batch:', error);
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar o lote.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const addSupplier = async (supplierId: string) => {
    try {
      const { data: supplierRow, error: supplierError } = await supabase
        .from('quote_batch_suppliers')
        .insert([{ quote_batch_id: batchId, supplier_id: supplierId }])
        .select('id')
        .single();
      if (supplierError) throw supplierError;

      if (items.length > 0) {
        const { error: lineItemsError } = await supabase.from('quote_line_items').insert(
          items.map((item) => ({
            quote_batch_supplier_id: supplierRow.id as string,
            quote_batch_item_id: item.id,
          }))
        );
        if (lineItemsError) throw lineItemsError;
      }

      toast({ title: 'Fornecedor adicionado' });
      await fetchDetail();
    } catch (error) {
      console.error('Error adding supplier to quote batch:', error);
      toast({
        title: 'Erro ao adicionar fornecedor',
        description: 'Não foi possível adicionar o fornecedor a este lote.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return { batch, items, suppliers, loading, cancelBatch, addSupplier, refetch: fetchDetail };
};
