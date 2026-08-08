import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Supplier {
  id: string;
  contact_name: string;
  company_name: string;
  phone: string;
  email: string | null;
  avg_delivery_days: number | null;
  max_installments: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierInput {
  contact_name: string;
  company_name: string;
  phone: string;
  email: string | null;
  avg_delivery_days: number | null;
  max_installments: number | null;
  notes: string | null;
}

export const useSuppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('contact_name');

      if (error) throw error;
      setSuppliers((data as Supplier[]) || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: 'Erro ao carregar fornecedores',
        description: 'Não foi possível carregar a lista de fornecedores.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const createSupplier = async (input: SupplierInput) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .insert([input])
        .select()
        .single();

      if (error) throw error;

      setSuppliers((prev) => [...prev, data as Supplier].sort((a, b) => a.contact_name.localeCompare(b.contact_name, 'pt-BR')));
      toast({
        title: 'Fornecedor criado',
        description: `"${input.contact_name}" foi adicionado com sucesso.`,
      });
      return data;
    } catch (error) {
      console.error('Error creating supplier:', error);
      toast({
        title: 'Erro ao criar fornecedor',
        description: 'Não foi possível criar o fornecedor.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateSupplier = async (id: string, input: SupplierInput) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setSuppliers((prev) =>
        prev.map((supplier) => (supplier.id === id ? (data as Supplier) : supplier))
          .sort((a, b) => a.contact_name.localeCompare(b.contact_name, 'pt-BR'))
      );
      toast({ title: 'Fornecedor atualizado' });
      return data;
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast({
        title: 'Erro ao atualizar fornecedor',
        description: 'Não foi possível salvar as mudanças.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;

      setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id));
      toast({ title: 'Fornecedor excluído' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast({
        title: 'Erro ao excluir fornecedor',
        description: 'Não foi possível excluir o fornecedor.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return { suppliers, loading, createSupplier, updateSupplier, deleteSupplier, refetch: fetchSuppliers };
};
