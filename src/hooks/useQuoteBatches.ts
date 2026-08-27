import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';

export interface QuoteBatchSummary {
  id: string;
  status: 'aberto' | 'cancelado' | 'concluido';
  created_by_name: string;
  created_at: string;
  item_count: number;
  supplier_count: number;
  suppliers_reviewed_count: number;
}

export interface QuoteBatchItemInput {
  missingProductId: string;
  quantity: number | null;
}

// Marca o erro de revalidação (Fix 5 do review final) pra distinguir dos
// outros erros de createBatch no catch — sem isso, o catch genérico
// mostrava sempre "não foi possível criar o lote", escondendo a única
// mensagem que diz o que fazer (atualizar a lista e tentar de novo).
class QuoteItemsAlreadyOpenError extends Error {}

export const useQuoteBatches = () => {
  const { user } = useAuth();
  const { displayName, status: displayNameStatus } = useCurrentStaffName();
  const [batches, setBatches] = useState<QuoteBatchSummary[]>([]);
  const [openItemIds, setOpenItemIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('quote_batches')
        .select('id, status, created_by_name, created_at, quote_batch_items(count), quote_batch_suppliers(status)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []) as unknown as Array<{
        id: string;
        status: 'aberto' | 'cancelado' | 'concluido';
        created_by_name: string;
        created_at: string;
        quote_batch_items: { count: number }[];
        quote_batch_suppliers: { status: 'pendente' | 'revisado' }[];
      }>;

      setBatches(
        rows.map((row) => ({
          id: row.id,
          status: row.status,
          created_by_name: row.created_by_name,
          created_at: row.created_at,
          item_count: row.quote_batch_items[0]?.count ?? 0,
          supplier_count: row.quote_batch_suppliers.length,
          suppliers_reviewed_count: row.quote_batch_suppliers.filter((s) => s.status === 'revisado').length,
        }))
      );
    } catch (error) {
      console.error('Error fetching quote batches:', error);
      toast({
        title: 'Erro ao carregar cotações',
        description: 'Não foi possível carregar a lista de lotes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Itens que já estão em algum lote com status 'aberto' — usado pra
  // desabilitar esses itens na hora de montar um lote novo (Task 9) e pro
  // indicador "Em cotação" em Faltantes (Task 8). !inner é obrigatório: sem
  // ele o filtro em quote_batches.status não restringe as linhas de
  // quote_batch_items, só zera o embed.
  const fetchOpenItemIds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('quote_batch_items')
        .select('missing_product_id, quote_batches!inner(status)')
        .eq('quote_batches.status', 'aberto');

      if (error) throw error;
      setOpenItemIds(new Set((data || []).map((row) => row.missing_product_id as string)));
    } catch (error) {
      console.error('Error fetching open quote batch items:', error);
    }
  }, []);

  const refetch = useCallback(async () => {
    await Promise.all([fetchBatches(), fetchOpenItemIds()]);
  }, [fetchBatches, fetchOpenItemIds]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Sequência de 4 inserts (não é uma transação de banco única — o projeto
  // não usa funções RPC pra atomicidade multi-tabela em nenhum outro lugar,
  // então isso segue a mesma convenção já aceita). Se falhar no meio, o
  // pior caso é um lote com itens mas sem fornecedores (ou vice-versa) —
  // recuperável cancelando e criando de novo, não corrompe nada.
  const createBatch = async (items: QuoteBatchItemInput[], supplierIds: string[]): Promise<string | null> => {
    if (!user) throw new Error('Usuário não autenticado');
    if (!displayName) {
      throw new Error('Não foi possível identificar seu nome de exibição. Recarregue a página e tente novamente.');
    }
    if (items.length === 0 || supplierIds.length === 0) {
      throw new Error('Escolha pelo menos 1 item e 1 fornecedor.');
    }

    try {
      const missingProductIds = items.map((item) => item.missingProductId);
      const { data: stillOpenItems, error: openItemsError } = await supabase
        .from('quote_batch_items')
        .select('missing_product_id, quote_batches!inner(status)')
        .eq('quote_batches.status', 'aberto')
        .in('missing_product_id', missingProductIds);
      if (openItemsError) throw openItemsError;
      if (stillOpenItems && stillOpenItems.length > 0) {
        throw new QuoteItemsAlreadyOpenError(
          'Um ou mais itens escolhidos já entraram em outro lote aberto nesse meio-tempo. Atualize a lista e tente de novo.'
        );
      }

      const { data: batch, error: batchError } = await supabase
        .from('quote_batches')
        .insert([{ created_by: user.id, created_by_name: displayName }])
        .select('id')
        .single();
      if (batchError) throw batchError;

      const batchId = batch.id as string;

      const { data: itemRows, error: itemsError } = await supabase
        .from('quote_batch_items')
        .insert(
          items.map((item) => ({
            quote_batch_id: batchId,
            missing_product_id: item.missingProductId,
            quantity: item.quantity,
          }))
        )
        .select('id');
      if (itemsError) throw itemsError;

      const { data: supplierRows, error: suppliersError } = await supabase
        .from('quote_batch_suppliers')
        .insert(supplierIds.map((supplierId) => ({ quote_batch_id: batchId, supplier_id: supplierId })))
        .select('id');
      if (suppliersError) throw suppliersError;

      const lineItems = (supplierRows || []).flatMap((supplierRow) =>
        (itemRows || []).map((itemRow) => ({
          quote_batch_supplier_id: supplierRow.id as string,
          quote_batch_item_id: itemRow.id as string,
        }))
      );
      const { error: lineItemsError } = await supabase.from('quote_line_items').insert(lineItems);
      if (lineItemsError) throw lineItemsError;

      toast({
        title: 'Cotação criada',
        description: `Lote criado com ${itemRows?.length ?? 0} item(ns) e ${supplierRows?.length ?? 0} fornecedor(es).`,
      });
      await refetch();
      return batchId;
    } catch (error) {
      console.error('Error creating quote batch:', error);
      toast({
        title: 'Erro ao criar cotação',
        description:
          error instanceof QuoteItemsAlreadyOpenError ? error.message : 'Não foi possível criar o lote. Tente novamente.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return { batches, openItemIds, loading, displayNameStatus, createBatch, refetch };
};
