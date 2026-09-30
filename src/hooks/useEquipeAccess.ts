import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type EquipePapel = 'admin' | 'gestor' | 'colaborador';

export interface EquipeAccess {
  loading: boolean;
  /** Tem papel no módulo Equipe (ou é admin geral do painel). */
  isEquipe: boolean;
  papel: EquipePapel | null;
  isEquipeAdmin: boolean;
  isGestorOuAdmin: boolean;
  /** Empresas que este usuário pode ver. Admin vê todas. */
  empresaIds: string[];
  /** Empresa do próprio usuário (staff_members.empresa_id). */
  minhaEmpresaId: string | null;
}

const EMPTY: Omit<EquipeAccess, 'loading'> = {
  isEquipe: false,
  papel: null,
  isEquipeAdmin: false,
  isGestorOuAdmin: false,
  empresaIds: [],
  minhaEmpresaId: null,
};

export const useEquipeAccess = (): EquipeAccess => {
  const { user } = useAuth();
  const [access, setAccess] = useState<EquipeAccess>({ loading: true, ...EMPTY });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        if (!cancelled) setAccess({ loading: false, ...EMPTY });
        return;
      }

      setAccess((prev) => ({ ...prev, loading: true }));

      const [{ data: member }, { data: papelRow }] = await Promise.all([
        supabase.from('staff_members').select('is_admin, empresa_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('equipe_papeis').select('papel').eq('user_id', user.id).maybeSingle(),
      ]);

      if (!member) {
        if (!cancelled) setAccess({ loading: false, ...EMPTY });
        return;
      }

      // Admin do painel é automaticamente admin de equipe — mesma regra do
      // is_equipe_admin() no banco, pra não precisar cadastrar o dono duas vezes.
      const papel = (papelRow?.papel as EquipePapel | undefined) ?? null;
      const isEquipeAdmin = member.is_admin || papel === 'admin';
      const isGestorOuAdmin = isEquipeAdmin || papel === 'gestor';

      let empresaIds: string[] = [];
      if (isEquipeAdmin) {
        const { data: empresas } = await supabase.from('empresas').select('id').eq('ativo', true);
        empresaIds = (empresas ?? []).map((e) => e.id);
      } else if (papel === 'gestor') {
        const { data: vinculos } = await supabase
          .from('equipe_gestor_empresas')
          .select('empresa_id')
          .eq('user_id', user.id);
        empresaIds = (vinculos ?? []).map((v) => v.empresa_id);
      } else if (member.empresa_id) {
        empresaIds = [member.empresa_id];
      }

      if (!cancelled) {
        setAccess({
          loading: false,
          isEquipe: isGestorOuAdmin || papel === 'colaborador',
          papel: papel ?? (member.is_admin ? 'admin' : null),
          isEquipeAdmin,
          isGestorOuAdmin,
          empresaIds,
          minhaEmpresaId: member.empresa_id ?? null,
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
