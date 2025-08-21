import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface Category {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories((data as Category[]) || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: "Erro ao carregar categorias",
        description: "Não foi possível carregar as categorias.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createCategory = async (name: string) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{ name }])
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, data as Category].sort((a, b) => a.name.localeCompare(b.name)));
      toast({
        title: "Categoria criada",
        description: `Categoria "${name}" foi criada com sucesso.`,
      });
      return data;
    } catch (error: any) {
      console.error('Error creating category:', error);
      if (error.code === '23505') {
        toast({
          title: "Categoria já existe",
          description: "Esta categoria já está cadastrada.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro ao criar categoria",
          description: "Não foi possível criar a categoria.",
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const updateCategory = async (id: string, name: string) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => prev.map(cat => cat.id === id ? data as Category : cat).sort((a, b) => a.name.localeCompare(b.name)));
      toast({
        title: "Categoria atualizada",
        description: `Categoria atualizada para "${name}".`,
      });
      return data;
    } catch (error: any) {
      console.error('Error updating category:', error);
      if (error.code === '23505') {
        toast({
          title: "Categoria já existe",
          description: "Esta categoria já está cadastrada.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro ao atualizar categoria",
          description: "Não foi possível atualizar a categoria.",
          variant: "destructive"
        });
      }
      throw error;
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    try {
      // Check if there are products using this category
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('category', name);

      if (productsError) throw productsError;

      if (products && products.length > 0) {
        const confirmDelete = window.confirm(
          `Esta categoria tem ${products.length} produto(s). Tem certeza que deseja excluir? Todos os produtos desta categoria terão a categoria removida.`
        );
        
        if (!confirmDelete) return;

        // Update products to remove category reference
        await supabase
          .from('products')
          .update({ category: null })
          .eq('category', name);
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => prev.filter(cat => cat.id !== id));
      toast({
        title: "Categoria removida",
        description: `Categoria "${name}" foi removida com sucesso.`,
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Erro ao remover categoria",
        description: "Não foi possível remover a categoria.",
        variant: "destructive"
      });
      throw error;
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    refetch: fetchCategories
  };
};