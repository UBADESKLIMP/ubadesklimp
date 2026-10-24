import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AdminHomeSummary {
  loading: boolean;
  faltandoAgora: number | null;
  avisadosVariasVezes: number | null;
  cotacoesAbertas: number | null;
  pedidosNovos: number | null;
  entregasNaFila: number | null;
}

interface Wanted {
  faltantes: boolean;
  cotacoes: boolean;
  pedidos: boolean;
  entregas: boolean;
}

const EMPTY: AdminHomeSummary = {
  loading: true,
  faltandoAgora: null,
  avisadosVariasVezes: null,
  cotacoesAbertas: null,
  pedidosNovos: null,
  entregasNaFila: null,
};

// Só conta o que a pessoa pode ver (as policies do banco também barram). Cada
// contagem que falha vira null e a tela esconde aquele cartão, em vez de
// mostrar um zero que enganaria.
export const useAdminHomeSummary = (wanted: Wanted): AdminHomeSummary => {
  const [summary, setSummary] = useState<AdminHomeSummary>(EMPTY);
  const { faltantes, cotacoes, pedidos, entregas } = wanted;

  useEffect(() => {
    let cancelled = false;

    const count = async (run: () => PromiseLike<{ count: number | null; error: unknown }>) => {
      try {
        const { count: total, error } = await run();
        return error ? null : total ?? 0;
      } catch {
        return null;
      }
    };

    const load = async () => {
      const [faltando, varias, abertas, novos, fila] = await Promise.all([
        faltantes
          ? count(() => supabase.from('missing_products').select('id', { count: 'exact', head: true }).eq('status', 'pendente'))
          : null,
        faltantes
          ? count(() =>
              supabase
                .from('missing_products')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pendente')
                .gt('report_count', 1)
            )
          : null,
        cotacoes
          ? count(() => supabase.from('quote_batches').select('id', { count: 'exact', head: true }).eq('status', 'aberto'))
          : null,
        pedidos
          ? count(() => supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'))
          : null,
        entregas
          ? count(() =>
              supabase
                .from('entregas')
                .select('id', { count: 'exact', head: true })
                .in('situacao', ['na_fila', 'em_rota'])
            )
          : null,
      ]);
      if (cancelled) return;
      setSummary({
        loading: false,
        faltandoAgora: faltando,
        avisadosVariasVezes: varias,
        cotacoesAbertas: abertas,
        pedidosNovos: novos,
        entregasNaFila: fila,
      });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [faltantes, cotacoes, pedidos, entregas]);

  return summary;
};
