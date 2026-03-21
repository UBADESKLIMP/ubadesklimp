import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CLEANUP_KEY = 'supabase_storage_cleanup_done';
const CLEANUP_MONTH = '2025-04'; // abril 2025

export const useStorageCleanup = () => {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const doneKey = `${CLEANUP_KEY}_${currentMonth}`;

    // Só executa a partir de abril e se ainda não fez neste mês
    if (currentMonth < CLEANUP_MONTH && localStorage.getItem(doneKey)) return;
    if (localStorage.getItem(doneKey)) return;

    const runCleanup = async () => {
      try {
        // Testar se o Supabase está acessível fazendo uma query leve
        const { error: testError } = await supabase
          .from('categories')
          .select('id')
          .limit(1);

        if (testError) {
          console.log('[StorageCleanup] Supabase ainda restrito, tentando próxima vez.');
          return;
        }

        console.log('[StorageCleanup] Supabase acessível! Executando limpeza do storage...');

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/cleanup-storage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const result = await response.json();

        if (result.success) {
          console.log(`[StorageCleanup] ✅ Limpeza concluída! ${result.totalDeleted} arquivos removidos.`);
          localStorage.setItem(doneKey, new Date().toISOString());
        } else {
          console.warn('[StorageCleanup] ⚠️ Erro na limpeza:', result.error);
        }
      } catch (err) {
        console.log('[StorageCleanup] Supabase indisponível, tentando próxima vez.');
      }
    };

    // Delay de 5s para não competir com o carregamento inicial
    const timer = setTimeout(runCleanup, 5000);
    return () => clearTimeout(timer);
  }, []);
};
