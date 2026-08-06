import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type StaffPermission = 'faltantes' | 'produtos' | 'fornecedores' | 'financeiro';

interface StaffAccess {
  loading: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  permissions: Set<StaffPermission>;
}

const EMPTY_ACCESS: Omit<StaffAccess, 'loading'> = {
  isStaff: false,
  isAdmin: false,
  permissions: new Set(),
};

export const useStaffAccess = (): StaffAccess => {
  const { user } = useAuth();
  const [access, setAccess] = useState<StaffAccess>({ loading: true, ...EMPTY_ACCESS });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        if (!cancelled) setAccess({ loading: false, ...EMPTY_ACCESS });
        return;
      }

      setAccess((prev) => ({ ...prev, loading: true }));

      const { data: member } = await supabase
        .from('staff_members')
        .select('is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member) {
        if (!cancelled) setAccess({ loading: false, ...EMPTY_ACCESS });
        return;
      }

      const { data: permissionRows } = await supabase
        .from('staff_permissions')
        .select('permission')
        .eq('user_id', user.id);

      if (!cancelled) {
        setAccess({
          loading: false,
          isStaff: true,
          isAdmin: member.is_admin,
          permissions: new Set((permissionRows || []).map((row) => row.permission as StaffPermission)),
        });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return access;
};
