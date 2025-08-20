
import { useState } from 'react';
import { Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCategories } from '@/hooks/useCategories';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const CategoryManager = () => {
  const { categories, refetch } = useCategories();
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    if (categories.includes(newCategory.trim())) {
      toast({
        title: "Categoria já existe",
        description: "Esta categoria já está cadastrada.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Add a temporary product with the new category to ensure it appears in the database
      // This is a workaround since we're getting categories from products table
      const { error } = await supabase
        .from('products')
        .insert([{
          name: `Produto Temporário - ${newCategory}`,
          description: 'Produto temporário para criar categoria',
          price: 0,
          category: newCategory.trim(),
          image_url: null
        }]);

      if (error) throw error;

      toast({
        title: "Categoria adicionada",
        description: `Categoria "${newCategory}" foi criada com sucesso.`,
      });

      setNewCategory('');
      setIsDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Error adding category:', error);
      toast({
        title: "Erro ao adicionar categoria",
        description: "Não foi possível adicionar a categoria.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategory = async (oldCategory: string, newCategoryName: string) => {
    if (!newCategoryName.trim() || newCategoryName === oldCategory) {
      setEditingCategory(null);
      return;
    }

    if (categories.includes(newCategoryName.trim()) && newCategoryName !== oldCategory) {
      toast({
        title: "Categoria já existe",
        description: "Esta categoria já está cadastrada.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({ category: newCategoryName.trim() })
        .eq('category', oldCategory);

      if (error) throw error;

      toast({
        title: "Categoria atualizada",
        description: `Categoria atualizada para "${newCategoryName}".`,
      });

      setEditingCategory(null);
      refetch();
    } catch (error) {
      console.error('Error updating category:', error);
      toast({
        title: "Erro ao atualizar categoria",
        description: "Não foi possível atualizar a categoria.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (category: string) => {
    const productsWithCategory = await supabase
      .from('products')
      .select('id')
      .eq('category', category);

    if (productsWithCategory.data && productsWithCategory.data.length > 0) {
      const confirmDelete = window.confirm(
        `Esta categoria tem ${productsWithCategory.data.length} produto(s). Tem certeza que deseja excluir? Todos os produtos desta categoria serão removidos.`
      );
      
      if (!confirmDelete) return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('category', category);

      if (error) throw error;

      toast({
        title: "Categoria removida",
        description: `Categoria "${category}" foi removida com sucesso.`,
      });

      refetch();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast({
        title: "Erro ao remover categoria",
        description: "Não foi possível remover a categoria.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Gerenciar Categorias</CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary">
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Categoria</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Nome da categoria"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <div className="flex space-x-2">
                  <Button onClick={handleAddCategory} disabled={loading || !newCategory.trim()}>
                    Adicionar
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {categories.map((category) => (
            <div key={category} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              {editingCategory === category ? (
                <div className="flex items-center space-x-2 flex-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleEditCategory(category, editValue);
                      if (e.key === 'Escape') setEditingCategory(null);
                    }}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleEditCategory(category, editValue)}
                    disabled={loading}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingCategory(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium">{category}</span>
                  <div className="flex space-x-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingCategory(category);
                        setEditValue(category);
                      }}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteCategory(category)}
                      className="text-destructive hover:text-destructive"
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              Nenhuma categoria encontrada. Adicione produtos para criar categorias.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoryManager;
