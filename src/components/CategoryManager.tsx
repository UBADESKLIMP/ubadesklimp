import { useState } from 'react';
import { Plus, Trash2, Edit3, Check, X, Car, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCategories, Category } from '@/hooks/useCategories';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
import { Tags } from 'lucide-react';

interface CategoryListProps {
  categories: Category[];
  loading: boolean;
  editingCategory: string | null;
  editValue: string;
  saving: boolean;
  onStartEdit: (id: string, name: string) => void;
  onEditCategory: (id: string, oldName: string, newName: string) => void;
  onCancelEdit: () => void;
  onDeleteCategory: (id: string, name: string) => void;
  onEditValueChange: (value: string) => void;
  emptyMessage: string;
  type: 'limpeza' | 'automotivo';
}

const CategoryList = ({
  categories,
  loading,
  editingCategory,
  editValue,
  saving,
  onStartEdit,
  onEditCategory,
  onCancelEdit,
  onDeleteCategory,
  onEditValueChange,
  emptyMessage,
  type
}: CategoryListProps) => {
  if (loading) {
    return <AdminLoadingState rows={3} />;
  }

  if (categories.length === 0) {
    return <AdminEmptyState icon={Tags} title={emptyMessage} />;
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => (
        <div 
          key={category.id} 
          className={`flex items-center justify-between p-3 rounded-lg ${
            type === 'automotivo' 
              ? 'bg-blue-500/10 border border-blue-500/20' 
              : 'bg-muted/50'
          }`}
        >
          {editingCategory === category.id ? (
            <div className="flex items-center space-x-2 flex-1">
              <Input
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') onEditCategory(category.id, category.name, editValue);
                  if (e.key === 'Escape') onCancelEdit();
                }}
                autoFocus
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEditCategory(category.id, category.name, editValue)}
                disabled={saving}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onCancelEdit}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {type === 'automotivo' && <Car className="h-4 w-4 text-blue-400" />}
                {type === 'limpeza' && <Droplets className="h-4 w-4 text-primary" />}
                <span className="font-medium">{category.name}</span>
              </div>
              <div className="flex space-x-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onStartEdit(category.id, category.name)}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onDeleteCategory(category.id, category.name)}
                  className="text-destructive hover:text-destructive"
                  disabled={saving}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

const CategoryManager = () => {
  const { categories: limpezaCategories, loading: limpezaLoading, createCategory: createLimpeza, updateCategory: updateLimpeza, deleteCategory: deleteLimpeza } = useCategories('limpeza');
  const { categories: automotiveCategories, loading: autoLoading, createCategory: createAuto, updateCategory: updateAuto, deleteCategory: deleteAuto } = useCategories('automotivo');
  
  const [newCategory, setNewCategory] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'limpeza' | 'automotivo'>('limpeza');

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;

    setSaving(true);
    try {
      if (activeTab === 'limpeza') {
        await createLimpeza(newCategory.trim(), 'limpeza');
      } else {
        await createAuto(newCategory.trim(), 'automotivo');
      }
      setNewCategory('');
      setIsDialogOpen(false);
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setSaving(false);
    }
  };

  const handleEditCategory = async (id: string, oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) {
      setEditingCategory(null);
      return;
    }

    setSaving(true);
    try {
      if (activeTab === 'limpeza') {
        await updateLimpeza(id, newName.trim());
      } else {
        await updateAuto(id, newName.trim());
      }
      setEditingCategory(null);
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    setSaving(true);
    try {
      if (activeTab === 'limpeza') {
        await deleteLimpeza(id, name);
      } else {
        await deleteAuto(id, name);
      }
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingCategory(id);
    setEditValue(name);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
  };

  return (
    <Card>
      <CardHeader>
        <AdminPageHeader
          icon={Tags}
          title="Categorias"
          description="Organize as categorias de limpeza e automotivo."
        />
        <div className="flex justify-end items-center -mt-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className={activeTab === 'automotivo' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-primary'}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {activeTab === 'automotivo' && <Car className="h-5 w-5 text-blue-400" />}
                  {activeTab === 'limpeza' && <Droplets className="h-5 w-5 text-primary" />}
                  Adicionar Nova Categoria ({activeTab === 'automotivo' ? 'Automotivo' : 'Limpeza'})
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Nome da categoria"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <div className="flex space-x-2">
                  <Button 
                    onClick={handleAddCategory} 
                    disabled={saving || !newCategory.trim()}
                    className={activeTab === 'automotivo' ? 'bg-blue-600 hover:bg-blue-500' : ''}
                  >
                    {saving ? 'Salvando...' : 'Adicionar'}
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
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'limpeza' | 'automotivo')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="limpeza" className="flex items-center gap-2">
              <Droplets className="h-4 w-4" />
              Limpeza
              <Badge variant="secondary" className="ml-1">{limpezaCategories.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="automotivo" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Automotivo
              <Badge variant="secondary" className="ml-1 bg-blue-500/20 text-blue-600">{automotiveCategories.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="limpeza">
            <CategoryList
              categories={limpezaCategories}
              loading={limpezaLoading}
              editingCategory={editingCategory}
              editValue={editValue}
              saving={saving}
              onStartEdit={handleStartEdit}
              onEditCategory={handleEditCategory}
              onCancelEdit={handleCancelEdit}
              onDeleteCategory={handleDeleteCategory}
              onEditValueChange={setEditValue}
              emptyMessage="Nenhuma categoria de limpeza. Adicione sua primeira categoria."
              type="limpeza"
            />
          </TabsContent>

          <TabsContent value="automotivo">
            <CategoryList
              categories={automotiveCategories}
              loading={autoLoading}
              editingCategory={editingCategory}
              editValue={editValue}
              saving={saving}
              onStartEdit={handleStartEdit}
              onEditCategory={handleEditCategory}
              onCancelEdit={handleCancelEdit}
              onDeleteCategory={handleDeleteCategory}
              onEditValueChange={setEditValue}
              emptyMessage="Nenhuma categoria automotiva. Adicione sua primeira categoria."
              type="automotivo"
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default CategoryManager;
