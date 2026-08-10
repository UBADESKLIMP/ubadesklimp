import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface MissingProduct {
  id: string;
  product_id: string;
  fragrance_id: string | null;
  variation_id: string | null;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido';
  reported_by: string | null;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
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
  const [currentDisplayName, setCurrentDisplayName] = useState<string | null>(null);
  const [displayNameStatus, setDisplayNameStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // RLS de staff_members só deixa cada funcionário ver a própria linha, então
  // buscamos o display_name do usuário atual uma vez pra carimbar em
  // reported_by_name — não dá pra resolver o nome de OUTRO funcionário via
  // join (por isso o nome é gravado direto na linha, não buscado depois).
  useEffect(() => {
    if (!user) {
      setCurrentDisplayName(null);
      setDisplayNameStatus('ready');
      return;
    }
    setDisplayNameStatus('loading');
    supabase
      .from('staff_members')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching current user display name:', error);
          setDisplayNameStatus('error');
          return;
        }
        setCurrentDisplayName(data?.display_name ?? null);
        setDisplayNameStatus('ready');
      });
  }, [user]);

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

  useEffect(() => {
    fetchMissingProducts();
  }, [fetchMissingProducts]);

  return {
    missingProducts,
    loading,
    reportMissingProducts,
    resolveMissingProduct,
    refetch: fetchMissingProducts,
    displayNameStatus,
  };
};
