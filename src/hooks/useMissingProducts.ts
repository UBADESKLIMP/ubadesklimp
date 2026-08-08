import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface MissingProduct {
  id: string;
  product_id: string;
  stock_remaining: number | null;
  report_count: number;
  status: 'pendente' | 'resolvido';
  reported_by: string;
  reported_by_name: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissingProductReportItem {
  productId: string;
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

  // RLS de staff_members só deixa cada funcionário ver a própria linha, então
  // buscamos o display_name do usuário atual uma vez pra carimbar em
  // reported_by_name — não dá pra resolver o nome de OUTRO funcionário via
  // join (por isso o nome é gravado direto na linha, não buscado depois).
  useEffect(() => {
    if (!user) {
      setCurrentDisplayName(null);
      return;
    }
    supabase
      .from('staff_members')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setCurrentDisplayName(data?.display_name ?? null));
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
    const { error } = await supabase.from('missing_products').update(updatePayload).eq('id', existingId);
    if (error) throw error;
  };

  const reportMissingProducts = async (items: MissingProductReportItem[]): Promise<ReportBatchResult> => {
    if (!user) throw new Error('Usuário não autenticado');

    const userId = user.id;
    const reporterName = currentDisplayName || user.email || 'Funcionário';
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const item of items) {
      try {
        const { data: existing, error: fetchError } = await supabase
          .from('missing_products')
          .select('id, report_count')
          .eq('product_id', item.productId)
          .eq('status', 'pendente')
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existing) {
          await applyIncrement(existing.id, existing.report_count, item.stockRemaining, userId, reporterName);
        } else {
          const { error: insertError } = await supabase
            .from('missing_products')
            .insert([
              {
                product_id: item.productId,
                stock_remaining: item.stockRemaining,
                reported_by: userId,
                reported_by_name: reporterName,
              },
            ]);

          if (insertError) {
            // Código 23505 = violação de índice único: outra pessoa criou a
            // linha pendente entre o select acima e este insert. Busca a
            // linha que acabou de aparecer e trata como reporte de novo, em
            // vez de mostrar erro pro usuário por causa de uma corrida.
            if (insertError.code === '23505') {
              const { data: justCreated, error: refetchError } = await supabase
                .from('missing_products')
                .select('id, report_count')
                .eq('product_id', item.productId)
                .eq('status', 'pendente')
                .maybeSingle();

              if (refetchError || !justCreated) throw insertError;

              await applyIncrement(justCreated.id, justCreated.report_count, item.stockRemaining, userId, reporterName);
            } else {
              throw insertError;
            }
          }
        }

        succeeded.push(item.productId);
      } catch (error) {
        console.error('Error reporting missing product:', error, item);
        failed.push(item.productId);
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

  return { missingProducts, loading, reportMissingProducts, resolveMissingProduct, refetch: fetchMissingProducts };
};
