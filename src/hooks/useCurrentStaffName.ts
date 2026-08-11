import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type StaffNameStatus = 'loading' | 'ready' | 'error';

// RLS de staff_members só deixa cada funcionário ver a própria linha, então
// isso resolve só o nome de quem está logado agora — nunca o de outra
// pessoa. Usado pra carimbar campos denormalizados tipo "reported_by_name".
export const useCurrentStaffName = (): { displayName: string | null; status: StaffNameStatus } => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [status, setStatus] = useState<StaffNameStatus>('loading');

  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    supabase
      .from('staff_members')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching current user display name:', error);
          setStatus('error');
          return;
        }
        setDisplayName(data?.display_name ?? null);
        setStatus('ready');
      });
  }, [user]);

  return { displayName, status };
};
