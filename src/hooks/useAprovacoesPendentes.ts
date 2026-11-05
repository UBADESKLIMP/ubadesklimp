import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SEGUNDOS_ENTRE_CONFERENCIAS = 60;

/**
 * Quantos pedidos de ajuste de ponto estão esperando o gestor. Alimenta o
 * contador no menu ("Atrasos"), para o pedido que o funcionário faz no quiosque
 * não ficar esquecido. Só conta; a lista e a decisão ficam em Aprovações.
 */
export const useAprovacoesPendentes = (empresaIds: string[]) => {
  const [total, setTotal] = useState(0);
  const chave = empresaIds.join(',');

  const conferir = useCallback(async () => {
    if (empresaIds.length === 0) {
      setTotal(0);
      return;
    }
    const { count, error } = await supabase
      .from('equipe_justificativas_ponto')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .in('empresa_id', empresaIds);
    if (!error) setTotal(count ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    conferir();
    const agora = () => {
      if (document.visibilityState === 'visible') conferir();
    };
    const t = setInterval(agora, SEGUNDOS_ENTRE_CONFERENCIAS * 1000);
    document.addEventListener('visibilitychange', agora);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', agora);
    };
  }, [conferir]);

  return total;
};
