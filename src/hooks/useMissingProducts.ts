import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';

export interface MissingProduct {
  id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido' | 'cancelado' | 'pedido_enviado';
  reported_by: string | null;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  order_sent_at: string | null;
  order_sent_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissingProductReportItem {
  key: string;
  productId: string;
  fragranceId: string | null;
  variationId: string | null;
  stockRemaining: number | null;
}

export interface ReportBatchResult {
  succeeded: string[];
  failed: string[];
}

export const useMissingProducts = () => {
  const { user } = useAuth();
  const [missingProducts, setMissingProducts] = useState<MissingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const { displayName: currentDisplayName, status: displayNameStatus } = useCurrentStaffName();
  const [orderedProducts, setOrderedProducts] = useState<MissingProduct[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [supplierByMissingId, setSupplierByMissingId] = useState<Record<string, string>>({});

  const fetchMissingProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('missing_products')
        .select('*')
        .eq('status', 'pendente')
        .order('report_count', { ascending: false });

      if (error) throw error;
      setMissingProducts((data as MissingProduct[]) || []);
    } catch (error) {
      console.error('Error fetching missing products:', error);
      toast({
        title: 'Erro ao carregar faltantes',
        description: 'Não foi possível carregar a lista de produtos faltando.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Busca os itens 'pedido_enviado' + o nome do fornecedor pra quem o
  // pedido foi gerado, via quote_batch_items → quote_item_winners →
  // quote_batch_suppliers → suppliers (mesmo padrão de embed reverso/forward
  // já usado em useQuoteBatchComparison.ts). quote_item_winners vem como
  // array (relação reversa a partir de quote_batch_items), mesmo sendo no
  // máximo 1 por item — o unique constraint garante isso no banco, não no
  // formato da resposta.
  const fetchOrderedProducts = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('missing_products')
        .select('*')
        .eq('status', 'pedido_enviado')
        .order('order_sent_at', { ascending: false });
      if (error) throw error;
      const rows = (data as MissingProduct[]) || [];
      setOrderedProducts(rows);

      if (rows.length === 0) {
        setSupplierByMissingId({});
        return;
      }

      const { data: winnerRows, error: winnerError } = await supabase
        .from('quote_batch_items')
        .select('missing_product_id, quote_item_winners(quote_batch_suppliers(suppliers(company_name)))')
        .in(
          'missing_product_id',
          rows.map((row) => row.id)
        );
      if (winnerError) throw winnerError;

      const typedWinnerRows = (winnerRows || []) as unknown as Array<{
        missing_product_id: string;
        quote_item_winners: Array<{
          quote_batch_suppliers: { suppliers: { company_name: string } | null } | null;
        }>;
      }>;

      const nextSupplierByMissingId: Record<string, string> = {};
      for (const row of typedWinnerRows) {
        const companyName = row.quote_item_winners[0]?.quote_batch_suppliers?.suppliers?.company_name;
        if (companyName) nextSupplierByMissingId[row.missing_product_id] = companyName;
      }
      setSupplierByMissingId(nextSupplierByMissingId);
    } catch (error) {
      console.error('Error fetching ordered missing products:', error);
      toast({
        title: 'Erro ao carregar pedidos enviados',
        description: 'Não foi possível carregar os itens aguardando confirmação.',
        variant: 'destructive',
      });
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Busca a linha pendente pro combo exato (produto + fragrância + tamanho).
  // .is() é obrigatório pra comparar com null — .eq('col', null) não funciona
  // no Postgres (null = null nunca é true), então precisa dessa ramificação.
  const findExistingPending = (productId: string, fragranceId: string | null, variationId: string | null) => {
    let query = supabase
      .from('missing_products')
      .select('id, report_count')
      .eq('product_id', productId)
      .eq('status', 'pendente');

    query = fragranceId ? query.eq('fragrance_id', fragranceId) : query.is('fragrance_id', null);
    query = variationId ? query.eq('variation_id', variationId) : query.is('variation_id', null);

    return query.maybeSingle();
  };

  // Incrementa uma linha pendente já existente — usado tanto pro caminho
  // normal (já existia quando buscamos) quanto pra corrida (Postgres recusou
  // o insert por violar o índice único; buscamos a linha que apareceu nesse
  // meio-tempo e tratamos como um reporte de novo, sem propagar erro).
  const applyIncrement = async (
    existingId: string,
    existingReportCount: number,
    stockRemaining: number | null,
    userId: string,
    reporterName: string
  ) => {
    const updatePayload: Record<string, unknown> = {
      report_count: existingReportCount + 1,
      reported_by: userId,
      reported_by_name: reporterName,
    };
    if (stockRemaining !== null) {
      updatePayload.stock_remaining = stockRemaining;
    }
    const { data, error } = await supabase
      .from('missing_products')
      .update(updatePayload)
      .eq('id', existingId)
      .eq('status', 'pendente')
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Não foi possível atualizar: o produto pode ter sido resolvido nesse meio-tempo.');
    }
  };

  const reportMissingProducts = async (items: MissingProductReportItem[]): Promise<ReportBatchResult> => {
    if (!user) throw new Error('Usuário não autenticado');

    if (!currentDisplayName) {
      throw new Error('Não foi possível identificar seu nome de exibição. Recarregue a página e tente novamente.');
    }

    const userId = user.id;
    const reporterName = currentDisplayName;
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const item of items) {
      try {
        const { data: existing, error: fetchError } = await findExistingPending(
          item.productId,
          item.fragranceId,
          item.variationId
        );

        if (fetchError) throw fetchError;

        if (existing) {
          await applyIncrement(existing.id, existing.report_count, item.stockRemaining, userId, reporterName);
        } else {
          const { error: insertError } = await supabase
            .from('missing_products')
            .insert([
              {
                product_id: item.productId,
                fragrance_id: item.fragranceId,
                variation_id: item.variationId,
                stock_remaining: item.stockRemaining,
                reported_by: userId,
                reported_by_name: reporterName,
              },
            ]);

          if (insertError) {
            // Código 23505 = violação de índice único: outra pessoa criou a
            // linha pendente entre o select acima e este insert (ou o próprio
            // lote tinha duas linhas com o mesmo combo). Busca a linha que
            // acabou de aparecer e trata como reporte de novo, em vez de
            // mostrar erro pro usuário.
            if (insertError.code === '23505') {
              const { data: justCreated, error: refetchError } = await findExistingPending(
                item.productId,
                item.fragranceId,
                item.variationId
              );

              if (refetchError || !justCreated) throw insertError;

              await applyIncrement(justCreated.id, justCreated.report_count, item.stockRemaining, userId, reporterName);
            } else {
              throw insertError;
            }
          }
        }

        succeeded.push(item.key);
      } catch (error) {
        console.error('Error reporting missing product:', error, item);
        failed.push(item.key);
      }
    }

    await fetchMissingProducts();

    if (failed.length === 0) {
      toast({
        title: 'Faltantes registradas',
        description: `${succeeded.length} produto(s) registrado(s) com sucesso.`,
      });
    } else if (succeeded.length > 0) {
      toast({
        title: 'Alguns itens não foram registrados',
        description: `${succeeded.length} salvos, ${failed.length} com erro. Tente reenviar os que falharam.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Erro ao registrar faltantes',
        description: 'Não foi possível registrar os produtos.',
        variant: 'destructive',
      });
    }

    return { succeeded, failed };
  };

  const resolveMissingProduct = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({
          status: 'resolvido',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      // Se este item estava num lote de cotação aberto, tira a linha dele de
      // lá — resolvido por outro caminho não deve continuar aparecendo na
      // tabela de comparação. quote_line_items/quote_item_winners cascateiam
      // via FK (on delete cascade), então basta apagar quote_batch_items.
      const { data: openItems, error: openItemsError } = await supabase
        .from('quote_batch_items')
        .select('id, quote_batches!inner(status)')
        .eq('missing_product_id', id)
        .eq('quote_batches.status', 'aberto');
      if (openItemsError) {
        console.error('Error checking open quote batch items after resolve:', openItemsError);
      } else if (openItems && openItems.length > 0) {
        const { error: deleteError } = await supabase
          .from('quote_batch_items')
          .delete()
          .in(
            'id',
            openItems.map((row) => row.id)
          );
        if (deleteError) {
          console.error('Error removing resolved item from open quote batch:', deleteError);
        }
      }

      setMissingProducts((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Faltante resolvida' });
    } catch (error) {
      console.error('Error resolving missing product:', error);
      toast({
        title: 'Erro ao marcar como resolvido',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const cancelMissingProduct = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({
          status: 'cancelado',
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setMissingProducts((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Faltante cancelada' });
    } catch (error) {
      console.error('Error cancelling missing product:', error);
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar este item.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const confirmOrderReceived = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const { error } = await supabase
        .from('missing_products')
        .update({ status: 'resolvido', resolved_by: user.id, resolved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'pedido_enviado');
      if (error) throw error;

      setOrderedProducts((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Recebimento confirmado' });
    } catch (error) {
      console.error('Error confirming missing product order received:', error);
      toast({
        title: 'Erro ao confirmar',
        description: 'Não foi possível marcar como recebido.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const revertOrderToPending = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const target = orderedProducts.find((item) => item.id === id);
      if (!target) throw new Error('Item não encontrado na lista de pedidos enviados.');

      const { data: existingPending, error: findError } = await findExistingPending(
        target.product_id,
        target.fragrance_id,
        target.variation_id
      );
      if (findError) throw findError;

      if (existingPending) {
        // Já existe uma linha pendente pro mesmo produto (reportado de novo
        // enquanto este item estava em "pedido enviado") — soma o
        // report_count nela em vez de tentar voltar esta linha pra
        // pendente, o que bateria no índice único de "1 pendente por
        // produto" (missing_products_pending_item_idx).
        const { error: incrementError } = await supabase
          .from('missing_products')
          .update({ report_count: existingPending.report_count + 1 })
          .eq('id', existingPending.id)
          .eq('status', 'pendente');
        if (incrementError) throw incrementError;

        const { error: mergeError } = await supabase
          .from('missing_products')
          .update({ status: 'cancelado', cancelled_by: user.id, cancelled_at: new Date().toISOString() })
          .eq('id', id)
          .eq('status', 'pedido_enviado');
        if (mergeError) throw mergeError;
      } else {
        const { error } = await supabase
          .from('missing_products')
          .update({ status: 'pendente', order_sent_at: null, order_sent_by: null })
          .eq('id', id)
          .eq('status', 'pedido_enviado');
        if (error) throw error;
      }

      setOrderedProducts((prev) => prev.filter((item) => item.id !== id));
      await fetchMissingProducts();
      toast({ title: 'Item voltou pra pendente' });
    } catch (error) {
      console.error('Error reverting missing product order to pending:', error);
      toast({
        title: 'Erro ao reverter',
        description: 'Não foi possível voltar este item pra pendente.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchMissingProducts();
    fetchOrderedProducts();
  }, [fetchMissingProducts, fetchOrderedProducts]);

  return {
    missingProducts,
    loading,
    reportMissingProducts,
    resolveMissingProduct,
    cancelMissingProduct,
    refetch: fetchMissingProducts,
    displayNameStatus,
    orderedProducts,
    ordersLoading,
    supplierByMissingId,
    confirmOrderReceived,
    revertOrderToPending,
    refetchOrdered: fetchOrderedProducts,
  };
};
