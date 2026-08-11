import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { StaffPermission } from '@/hooks/useStaffAccess';
import { extractFunctionErrorMessage } from '@/lib/functionErrors';

export interface StaffMember {
  user_id: string;
  is_admin: boolean;
  display_name: string;
  created_at: string;
  permissions: StaffPermission[];
}

export const useStaffMembers = () => {
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStaffMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [membersResult, permissionsResult] = await Promise.all([
        supabase
          .from('staff_members')
          .select('user_id,is_admin,display_name,created_at')
          .order('created_at', { ascending: true }),
        supabase.from('staff_permissions').select('user_id,permission'),
      ]);

      if (membersResult.error) throw membersResult.error;

      const permissionsByUser = new Map<string, StaffPermission[]>();
      (permissionsResult.data || []).forEach((row) => {
        const list = permissionsByUser.get(row.user_id) || [];
        list.push(row.permission as StaffPermission);
        permissionsByUser.set(row.user_id, list);
      });

      setStaffMembers(
        (membersResult.data || []).map((member) => ({
          ...member,
          permissions: permissionsByUser.get(member.user_id) || [],
        }))
      );
    } catch (error) {
      console.error('Error fetching staff members:', error);
      toast({
        title: 'Erro ao carregar funcionários',
        description: 'Não foi possível carregar a lista de funcionários.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const createStaffMember = async (input: {
    username: string;
    password: string;
    displayName?: string;
    isAdmin: boolean;
    permissions: StaffPermission[];
  }) => {
    const { data, error } = await supabase.functions.invoke('criar-funcionario', {
      body: input,
    });

    if (error) {
      const message = await extractFunctionErrorMessage(error, 'Não foi possível criar o funcionário.');
      toast({ title: 'Erro ao criar funcionário', description: message, variant: 'destructive' });
      throw error;
    }

    toast({ title: 'Funcionário criado', description: `${input.username} já pode fazer login.` });
    await fetchStaffMembers();
    return data;
  };

  const updatePermissions = async (userId: string, isAdmin: boolean, permissions: StaffPermission[]) => {
    try {
      const { error: memberError } = await supabase
        .from('staff_members')
        .update({ is_admin: isAdmin })
        .eq('user_id', userId);
      if (memberError) throw memberError;

      const { error: deleteError } = await supabase.from('staff_permissions').delete().eq('user_id', userId);
      if (deleteError) throw deleteError;

      if (!isAdmin && permissions.length > 0) {
        const { error: insertError } = await supabase
          .from('staff_permissions')
          .insert(permissions.map((permission) => ({ user_id: userId, permission })));
        if (insertError) throw insertError;
      }

      toast({ title: 'Permissões atualizadas' });
      await fetchStaffMembers();
    } catch (error) {
      console.error('Error updating staff permissions:', error);
      toast({
        title: 'Erro ao atualizar permissões',
        description: 'Não foi possível salvar as mudanças.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteStaffMember = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke('excluir-funcionario', {
      body: { userId },
    });

    if (error) {
      const message = await extractFunctionErrorMessage(error, 'Não foi possível excluir o funcionário.');
      toast({ title: 'Erro ao excluir funcionário', description: message, variant: 'destructive' });
      throw error;
    }

    toast({ title: 'Funcionário excluído' });
    await fetchStaffMembers();
  };

  useEffect(() => {
    fetchStaffMembers();
  }, [fetchStaffMembers]);

  return { staffMembers, loading, createStaffMember, updatePermissions, deleteStaffMember, refetch: fetchStaffMembers };
};
