import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Nome de quem está logado, para o painel mostrar "quem está mexendo".
 * Usa o nome cadastrado na equipe; se não achar, cai para o e-mail/usuário.
 */
export const useMinhaConta = () => {
  const { user } = useAuth();
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setNome(null);
    if (!user) return;

    supabase
      .from('staff_members')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelado) setNome(data?.display_name?.trim() || null);
      });

    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  const email = user?.email ?? '';
  const login = email.split('@')[0];
  return { nome: nome || login || null, email };
};
