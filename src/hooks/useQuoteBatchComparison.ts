import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';

export interface ComparisonItem {
  id: string;
  missing_product_id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  quantity: number;
}

export interface ComparisonSupplier {
  id: string;
  company_name: string;
  phone: string;
}

type WinnerSource = 'auto' | 'manual' | 'ia';

export const useQuoteBatchComparison = (batchId: string) => {
  const { user } = useAuth();
  const { displayName } = useCurrentStaffName();
  const [loading, setLoading] = useState(true);
  const [batchStatus, setBatchStatus] = useState<'aberto' | 'cancelado' | 'concluido' | null>(null);
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [suppliers, setSuppliers] = useState<ComparisonSupplier[]>([]);
  const [priceByKey, setPriceByKey] = useState<Record<string, number | null>>({});
  const [winners, setWinners] = useState<Map<string, string>>(new Map());

  const priceKey = (itemId: string, supplierId: string) => `${itemId}::${supplierId}`;
  const getPrice = useCallback(
    (itemId: string, supplierId: string): number | null => priceByKey[priceKey(itemId, supplierId)] ?? null,
    [priceByKey]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: batchRow, error: batchError } = await supabase
        .from('quote_batches')
        .select('status')
        .eq('id', batchId)
        .single();
      if (batchError) throw batchError;
      setBatchStatus(batchRow.status as 'aberto' | 'cancelado' | 'concluido');

      const { data: itemRows, error: itemsError } = await supabase
        .from('quote_batch_items')
        .select('id, missing_product_id, quantity, missing_products(product_id, fragrance_id, variation_id)')
        .eq('quote_batch_id', batchId);
      if (itemsError) throw itemsError;

      const typedItemRows = (itemRows || []) as unknown as Array<{
        id: string;
        missing_product_id: string;
        quantity: number;
        missing_products: { product_id: string; fragrance_id: string | null; variation_id: string | null } | null;
      }>;
      const nextItems: ComparisonItem[] = typedItemRows.map((row) => ({
        id: row.id,
        missing_product_id: row.missing_product_id,
        product_id: row.missing_products?.product_id ?? '',
        fragrance_id: row.missing_products?.fragrance_id ?? null,
        variation_id: row.missing_products?.variation_id ?? null,
        quantity: row.quantity,
      }));
      setItems(nextItems);

      const { data: supplierRows, error: suppliersError } = await supabase
        .from('quote_batch_suppliers')
        .select('id, suppliers(company_name, phone), quote_line_items(quote_batch_item_id, price)')
        .eq('quote_batch_id', batchId);
      if (suppliersError) throw suppliersError;

      const typedSupplierRows = (supplierRows || []) as unknown as Array<{
        id: string;
        suppliers: { company_name: string; phone: string } | null;
        quote_line_items: { quote_batch_item_id: string; price: number | null }[];
      }>;

      const nextSuppliers: ComparisonSupplier[] = typedSupplierRows.map((row) => ({
        id: row.id,
        company_name: row.suppliers?.company_name ?? 'Fornecedor removido',
        phone: row.suppliers?.phone ?? '',
      }));
      setSuppliers(nextSuppliers);

      const nextPriceByKey: Record<string, number | null> = {};
      for (const supplierRow of typedSupplierRows) {
        for (const lineItem of supplierRow.quote_line_items) {
          nextPriceByKey[priceKey(lineItem.quote_batch_item_id, supplierRow.id)] = lineItem.price;
        }
      }
      setPriceByKey(nextPriceByKey);

      const { data: winnerRows, error: winnersError } = await supabase
        .from('quote_item_winners')
        .select('quote_batch_item_id, quote_batch_supplier_id')
        .in(
          'quote_batch_item_id',
          nextItems.map((item) => item.id)
        );
      if (winnersError) throw winnersError;

      const nextWinners = new Map<string, string>(
        (winnerRows || []).map((row) => [row.quote_batch_item_id as string, row.quote_batch_supplier_id as string])
      );

      // Inicialização automática: todo item sem vencedor ainda ganha o
      // fornecedor de menor preço não nulo. Item sem nenhum preço cotado
      // fica sem vencedor (nada pra escolher). Só roda quando o lote ainda
      // está aberto — lote concluído/cancelado não ganha vencedor novo.
      if (batchRow.status === 'aberto' && user && displayName) {
        const toInsert: Array<{
          quote_batch_item_id: string;
          quote_batch_supplier_id: string;
          source: WinnerSource;
          set_by: string;
          set_by_name: string;
        }> = [];
        for (const item of nextItems) {
          if (nextWinners.has(item.id)) continue;
          let cheapestSupplierId: string | null = null;
          let cheapestPrice = Infinity;
          for (const supplier of nextSuppliers) {
            const price = nextPriceByKey[priceKey(item.id, supplier.id)];
            if (price !== null && price !== undefined && price < cheapestPrice) {
              cheapestPrice = price;
              cheapestSupplierId = supplier.id;
            }
          }
          if (cheapestSupplierId) {
            toInsert.push({
              quote_batch_item_id: item.id,
              quote_batch_supplier_id: cheapestSupplierId,
              source: 'auto',
              set_by: user.id,
              set_by_name: displayName,
            });
            nextWinners.set(item.id, cheapestSupplierId);
          }
        }
        if (toInsert.length > 0) {
          const { error: insertWinnersError } = await supabase.from('quote_item_winners').insert(toInsert);
          if (insertWinnersError) {
            console.error('Error auto-assigning quote winners:', insertWinnersError);
          }
        }
      }

      setWinners(nextWinners);
    } catch (error) {
      console.error('Error fetching quote batch comparison:', error);
      toast({
        title: 'Erro ao carregar comparação',
        description: 'Não foi possível carregar os preços deste lote.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [batchId, user, displayName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setWinner = async (itemId: string, supplierId: string) => {
    if (!user || !displayName) return;
    try {
      const { error } = await supabase
        .from('quote_item_winners')
        .upsert(
          [
            {
              quote_batch_item_id: itemId,
              quote_batch_supplier_id: supplierId,
              source: 'manual' as WinnerSource,
              set_by: user.id,
              set_by_name: displayName,
              set_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'quote_batch_item_id' }
        );
      if (error) throw error;
      setWinners((prev) => {
        const next = new Map(prev);
        next.set(itemId, supplierId);
        return next;
      });
    } catch (error) {
      console.error('Error setting quote item winner:', error);
      toast({
        title: 'Erro ao trocar vencedor',
        description: 'Não foi possível salvar essa escolha.',
        variant: 'destructive',
      });
    }
  };

  return { loading, batchStatus, items, suppliers, getPrice, winners, setWinner, refetch: fetchData };
};
