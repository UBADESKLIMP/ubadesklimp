import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';
import { extractFunctionErrorMessage } from '@/lib/functionErrors';

export interface ComparisonItem {
  id: string;
  missing_product_id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  quantity: number | null;
}

export interface ComparisonSupplier {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  order_generated_at: string | null;
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
  const [noteByKey, setNoteByKey] = useState<Record<string, string | null>>({});
  const [excludedByKey, setExcludedByKey] = useState<Record<string, boolean>>({});
  const [correctedByKey, setCorrectedByKey] = useState<Record<string, boolean>>({});
  const [winners, setWinners] = useState<Map<string, string>>(new Map());
  const [winnerSources, setWinnerSources] = useState<Map<string, WinnerSource>>(new Map());

  const priceKey = (itemId: string, supplierId: string) => `${itemId}::${supplierId}`;
  const getPrice = useCallback(
    (itemId: string, supplierId: string): number | null => priceByKey[priceKey(itemId, supplierId)] ?? null,
    [priceByKey]
  );
  const getNote = useCallback(
    (itemId: string, supplierId: string): string | null => noteByKey[priceKey(itemId, supplierId)] ?? null,
    [noteByKey]
  );
  const getExcluded = useCallback(
    (itemId: string, supplierId: string): boolean => excludedByKey[priceKey(itemId, supplierId)] ?? false,
    [excludedByKey]
  );
  const getCorrected = useCallback(
    (itemId: string, supplierId: string): boolean => correctedByKey[priceKey(itemId, supplierId)] ?? false,
    [correctedByKey]
  );
  const getWinnerSource = useCallback(
    (itemId: string): WinnerSource | null => winnerSources.get(itemId) ?? null,
    [winnerSources]
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
        quantity: number | null;
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
        .select(
          'id, order_generated_at, suppliers(company_name, contact_name, phone), quote_line_items(quote_batch_item_id, price, notes, excluded_at, corrected_at)'
        )
        .eq('quote_batch_id', batchId);
      if (suppliersError) throw suppliersError;

      const typedSupplierRows = (supplierRows || []) as unknown as Array<{
        id: string;
        order_generated_at: string | null;
        suppliers: { company_name: string; contact_name: string; phone: string } | null;
        quote_line_items: {
          quote_batch_item_id: string;
          price: number | null;
          notes: string | null;
          excluded_at: string | null;
          corrected_at: string | null;
        }[];
      }>;

      const nextSuppliers: ComparisonSupplier[] = typedSupplierRows.map((row) => ({
        id: row.id,
        company_name: row.suppliers?.company_name ?? 'Fornecedor removido',
        contact_name: row.suppliers?.contact_name ?? '',
        phone: row.suppliers?.phone ?? '',
        order_generated_at: row.order_generated_at,
      }));
      setSuppliers(nextSuppliers);

      const nextPriceByKey: Record<string, number | null> = {};
      const nextNoteByKey: Record<string, string | null> = {};
      const nextExcludedByKey: Record<string, boolean> = {};
      const nextCorrectedByKey: Record<string, boolean> = {};
      for (const supplierRow of typedSupplierRows) {
        for (const lineItem of supplierRow.quote_line_items) {
          const key = priceKey(lineItem.quote_batch_item_id, supplierRow.id);
          nextPriceByKey[key] = lineItem.price;
          nextNoteByKey[key] = lineItem.notes;
          nextExcludedByKey[key] = lineItem.excluded_at !== null;
          nextCorrectedByKey[key] = lineItem.corrected_at !== null;
        }
      }
      setPriceByKey(nextPriceByKey);
      setNoteByKey(nextNoteByKey);
      setExcludedByKey(nextExcludedByKey);
      setCorrectedByKey(nextCorrectedByKey);

      const { data: winnerRows, error: winnersError } = await supabase
        .from('quote_item_winners')
        .select('quote_batch_item_id, quote_batch_supplier_id, source')
        .in(
          'quote_batch_item_id',
          nextItems.map((item) => item.id)
        );
      if (winnersError) throw winnersError;

      const nextWinners = new Map<string, string>(
        (winnerRows || []).map((row) => [row.quote_batch_item_id as string, row.quote_batch_supplier_id as string])
      );
      const nextWinnerSources = new Map<string, WinnerSource>(
        (winnerRows || []).map((row) => [row.quote_batch_item_id as string, row.source as WinnerSource])
      );

      // Inicialização/atualização automática: todo item sem vencedor válido
      // ganha o fornecedor de menor preço não nulo e não excluído. Vencedor
      // 'auto' é reavaliado a cada carregamento (preço mais barato pode ter
      // chegado depois). Vencedor cujo preço foi EXCLUÍDO é sempre
      // reavaliado, não importa como foi definido (manual/ia incluídos) — um
      // preço excluído não é mais válido, não existe "respeitar a escolha
      // manual" quando o valor escolhido deixou de existir. Escolha
      // manual/ia com preço ainda válido nunca é tocada aqui. Só roda com o
      // lote aberto.
      if (batchRow.status === 'aberto' && user && displayName) {
        const toInsert: Array<{
          quote_batch_item_id: string;
          quote_batch_supplier_id: string;
          source: WinnerSource;
          set_by: string;
          set_by_name: string;
        }> = [];
        const toUpdate: Array<{ quote_batch_item_id: string; quote_batch_supplier_id: string }> = [];
        const toDelete: string[] = [];

        for (const item of nextItems) {
          let cheapestSupplierId: string | null = null;
          let cheapestPrice = Infinity;
          for (const supplier of nextSuppliers) {
            const key = priceKey(item.id, supplier.id);
            const price = nextPriceByKey[key];
            if (price !== null && price !== undefined && !nextExcludedByKey[key] && price < cheapestPrice) {
              cheapestPrice = price;
              cheapestSupplierId = supplier.id;
            }
          }

          const currentWinnerId = nextWinners.get(item.id);
          const currentSource = nextWinnerSources.get(item.id);
          const currentWinnerExcluded = currentWinnerId
            ? nextExcludedByKey[priceKey(item.id, currentWinnerId)]
            : false;

          if (!currentWinnerId) {
            if (cheapestSupplierId) {
              toInsert.push({
                quote_batch_item_id: item.id,
                quote_batch_supplier_id: cheapestSupplierId,
                source: 'auto',
                set_by: user.id,
                set_by_name: displayName,
              });
              nextWinnerSources.set(item.id, 'auto');
            }
            continue;
          }

          if (currentWinnerExcluded) {
            if (cheapestSupplierId) {
              toUpdate.push({ quote_batch_item_id: item.id, quote_batch_supplier_id: cheapestSupplierId });
              nextWinnerSources.set(item.id, 'auto');
            } else {
              toDelete.push(item.id);
              nextWinners.delete(item.id);
              nextWinnerSources.delete(item.id);
            }
            continue;
          }

          if (currentSource === 'auto' && cheapestSupplierId && currentWinnerId !== cheapestSupplierId) {
            toUpdate.push({ quote_batch_item_id: item.id, quote_batch_supplier_id: cheapestSupplierId });
          }
        }

        if (toInsert.length > 0) {
          const { error: insertWinnersError } = await supabase.from('quote_item_winners').insert(toInsert);
          if (insertWinnersError) {
            console.error('Error auto-assigning quote winners:', insertWinnersError);
          } else {
            for (const row of toInsert) {
              nextWinners.set(row.quote_batch_item_id, row.quote_batch_supplier_id);
            }
          }
        }

        for (const row of toUpdate) {
          // Sem filtro de source: cobre tanto o auto desatualizado (preço
          // mais barato chegou) quanto o vencedor atual ter sido excluído
          // (mesmo se era manual/ia) — nos dois casos vira 'auto' de novo,
          // é uma reatribuição automática nova.
          const { error: updateWinnerError } = await supabase
            .from('quote_item_winners')
            .update({
              quote_batch_supplier_id: row.quote_batch_supplier_id,
              source: 'auto',
              set_by: user.id,
              set_by_name: displayName,
              set_at: new Date().toISOString(),
            })
            .eq('quote_batch_item_id', row.quote_batch_item_id);
          if (updateWinnerError) {
            console.error('Error refreshing quote winner:', updateWinnerError);
            continue;
          }
          nextWinners.set(row.quote_batch_item_id, row.quote_batch_supplier_id);
        }

        if (toDelete.length > 0) {
          const { error: deleteWinnersError } = await supabase
            .from('quote_item_winners')
            .delete()
            .in('quote_batch_item_id', toDelete);
          if (deleteWinnersError) {
            console.error('Error clearing quote winners with no valid price left:', deleteWinnersError);
          }
        }
      }

      setWinners(nextWinners);
      setWinnerSources(nextWinnerSources);
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
    if (getExcluded(itemId, supplierId)) return;
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
      setWinnerSources((prev) => {
        const next = new Map(prev);
        next.set(itemId, 'manual');
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

  const applyCommand = async (command: string): Promise<{ applied: number; skipped: number }> => {
    try {
      const { data, error } = await supabase.functions.invoke('apply-quote-reassignment', {
        body: { quoteBatchId: batchId, command },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error, 'Não foi possível aplicar o comando.');
        toast({ title: 'Erro no comando', description: message, variant: 'destructive' });
        throw error;
      }
      await fetchData();
      return { applied: data.applied as number, skipped: data.skipped as number };
    } catch (error) {
      console.error('Error applying quote reassignment command:', error);
      throw error;
    }
  };

  const setPriceExcluded = async (itemId: string, supplierId: string, excluded: boolean) => {
    if (!user || !displayName) return;
    try {
      const { data, error } = await supabase
        .from('quote_line_items')
        .update(
          excluded
            ? { excluded_at: new Date().toISOString(), excluded_by: user.id, excluded_by_name: displayName }
            : { excluded_at: null, excluded_by: null, excluded_by_name: null }
        )
        .eq('quote_batch_item_id', itemId)
        .eq('quote_batch_supplier_id', supplierId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Linha de preço não encontrada — este lote pode estar incompleto.');
      }
      await fetchData();
    } catch (error) {
      console.error('Error toggling quote line item exclusion:', error);
      toast({
        title: excluded ? 'Erro ao excluir preço' : 'Erro ao restaurar preço',
        description: 'Não foi possível salvar essa mudança.',
        variant: 'destructive',
      });
    }
  };

  const correctPrice = async (itemId: string, supplierId: string, price: number) => {
    if (!user || !displayName) return;
    try {
      const { data, error } = await supabase
        .from('quote_line_items')
        .update({
          price,
          updated_by: user.id,
          updated_by_name: displayName,
          corrected_at: new Date().toISOString(),
        })
        .eq('quote_batch_item_id', itemId)
        .eq('quote_batch_supplier_id', supplierId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Linha de preço não encontrada — este lote pode estar incompleto.');
      }
      await fetchData();
    } catch (error) {
      console.error('Error correcting quote line item price:', error);
      toast({
        title: 'Erro ao corrigir preço',
        description: 'Não foi possível salvar o valor.',
        variant: 'destructive',
      });
    }
  };

  const updateItemQuantity = async (itemId: string, quantity: number | null) => {
    try {
      const { error } = await supabase.from('quote_batch_items').update({ quantity }).eq('id', itemId);
      if (error) throw error;
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)));
    } catch (error) {
      console.error('Error updating quote batch item quantity:', error);
      toast({
        title: 'Erro ao salvar quantidade',
        description: 'Não foi possível salvar esse valor.',
        variant: 'destructive',
      });
    }
  };

  // Gera o pedido de um fornecedor: marca a primeira geração em
  // quote_batch_suppliers e move pra 'pedido_enviado' todo missing_product
  // ligado a um item em que ele é vencedor atual. Não exige que o lote
  // inteiro esteja pronto — só os itens deste fornecedor.
  const generateSupplierOrder = async (supplierId: string): Promise<boolean> => {
    if (!user || !displayName) return false;
    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) return false;

    const missingProductIds = items
      .filter((item) => winners.get(item.id) === supplierId)
      .map((item) => item.missing_product_id);
    if (missingProductIds.length === 0) return false;

    try {
      if (!supplier.order_generated_at) {
        const { error: supplierUpdateError } = await supabase
          .from('quote_batch_suppliers')
          .update({
            order_generated_at: new Date().toISOString(),
            order_generated_by: user.id,
            order_generated_by_name: displayName,
          })
          .eq('id', supplierId)
          .is('order_generated_at', null);
        if (supplierUpdateError) throw supplierUpdateError;
      }

      const { error: missingUpdateError } = await supabase
        .from('missing_products')
        .update({
          status: 'pedido_enviado',
          order_sent_at: new Date().toISOString(),
          order_sent_by: user.id,
        })
        .in('id', missingProductIds)
        .eq('status', 'pendente');
      if (missingUpdateError) throw missingUpdateError;

      toast({
        title: 'Pedido gerado',
        description: `${supplier.company_name}: ${missingProductIds.length} item(ns) marcados como pedido enviado.`,
      });
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error generating supplier order:', error);
      toast({
        title: 'Erro ao gerar pedido',
        description: 'Não foi possível marcar os itens como pedidos.',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Arquiva o lote — só organização, não mexe em Faltantes (isso já
  // aconteceu por fornecedor em generateSupplierOrder). Não exige que todo
  // item tenha vencedor: itens ainda sem cotação continuam pendentes
  // normalmente em Faltantes, disponíveis pra entrar num lote novo depois.
  const archiveBatch = async (): Promise<boolean> => {
    if (!user || !displayName) return false;
    try {
      const { error: batchUpdateError } = await supabase
        .from('quote_batches')
        .update({
          status: 'concluido',
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          completed_by_name: displayName,
        })
        .eq('id', batchId)
        .eq('status', 'aberto');
      if (batchUpdateError) throw batchUpdateError;

      toast({ title: 'Lote arquivado' });
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error archiving quote batch:', error);
      toast({
        title: 'Erro ao arquivar lote',
        description: 'Não foi possível arquivar o lote.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    loading,
    batchStatus,
    items,
    suppliers,
    getPrice,
    getNote,
    getExcluded,
    getCorrected,
    winners,
    getWinnerSource,
    setWinner,
    applyCommand,
    setPriceExcluded,
    correctPrice,
    updateItemQuantity,
    generateSupplierOrder,
    archiveBatch,
    refetch: fetchData,
  };
};
