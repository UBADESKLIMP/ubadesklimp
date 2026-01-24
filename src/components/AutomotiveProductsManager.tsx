import { useState, useCallback, useMemo } from 'react';
import { Plus, Car, DollarSign, TrendingUp, ShoppingBag, Tags, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useProducts } from '@/hooks/useProducts';
import { ProductWithVariations } from '@/types/product';
import ProductForm from '@/components/ProductForm';
import { supabase } from '@/integrations/supabase/client';
import { useSalesStats } from '@/hooks/useSalesStats';
import { useCategories } from '@/hooks/useCategories';
import DraggableAdminGrid from './DraggableAdminGrid';
import AdminProductFilters from './AdminProductFilters';

const AutomotiveProductsManager = () => {
  const { products, loading, createProduct, updateProduct, deleteProduct, updateDisplayOrder, refetch } = useProducts();
  const { stats: automotiveStats, loading: statsLoading } = useSalesStats('automotivo');
  const { categories: automotiveCategories, loading: catLoading, createCategory, deleteCategory } = useCategories('automotivo');
  const [editingProduct, setEditingProduct] = useState<ProductWithVariations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Filtrar apenas produtos automotivos (por line_type ou fallback para category)
  const automotiveProducts = useMemo(() => 
    products.filter(
      (product) => product.line_type === 'automotivo' || product.category?.toLowerCase() === 'automotivo'
    ),
    [products]
  );

  // Aplicar filtros de busca e categoria
  const filteredAutomotiveProducts = useMemo(() => {
    return automotiveProducts.filter(product => {
      const matchesSearch = 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = 
        categoryFilter === 'all' || product.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [automotiveProducts, searchTerm, categoryFilter]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const handleSaveProduct = async (productData: any) => {
    try {
      const { fragrances, ...productPayload } = productData;
      // Forçar linha automotiva
      productPayload.line_type = 'automotivo';

      if (editingProduct) {
        await updateProduct(editingProduct.id, productPayload);

        if (fragrances && fragrances.length > 0) {
          await supabase
            .from('product_fragrances')
            .delete()
            .eq('product_id', editingProduct.id);

          const fragrancesToInsert = fragrances.map((fragrance: any) => ({
            product_id: editingProduct.id,
            name: fragrance.name,
            description: fragrance.description || null,
            image_url: fragrance.image_url || null,
            available_literages: fragrance.available_literages || [],
            order_index: fragrance.order || 0
          }));

          await supabase.from('product_fragrances').insert(fragrancesToInsert);
          await supabase
            .from('products')
            .update({ has_fragrances: fragrances.length > 0 })
            .eq('id', editingProduct.id);
        }

        await refetch();
      } else {
        const savedProduct = await createProduct(productPayload);

        if (fragrances && fragrances.length > 0 && savedProduct?.id) {
          const fragrancesToInsert = fragrances.map((fragrance: any) => ({
            product_id: savedProduct.id,
            name: fragrance.name,
            description: fragrance.description || null,
            image_url: fragrance.image_url || null,
            available_literages: fragrance.available_literages || [],
            order_index: fragrance.order || 0
          }));

          await supabase.from('product_fragrances').insert(fragrancesToInsert);
          await supabase
            .from('products')
            .update({ has_fragrances: true })
            .eq('id', savedProduct.id);
        }

        await refetch();
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto automotivo?')) {
      await deleteProduct(id);
    }
  };

  const handleReorderProducts = useCallback(async (reorderedProducts: ProductWithVariations[]) => {
    await updateDisplayOrder(reorderedProducts);
  }, [updateDisplayOrder]);

  const formatProductPrice = (price: number | undefined) => {
    if (!price) return 'Preço não definido';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] bg-[#0a0a0f] rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🚗</div>
          <h3 className="text-xl font-semibold text-white mb-2">Carregando produtos automotivos...</h3>
        </div>
      </div>
    );
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await createCategory(newCategoryName.trim(), 'automotivo');
      setNewCategoryName('');
      setIsCategoryDialogOpen(false);
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    await deleteCategory(id, name);
  };

  return (
    <div className="min-h-[500px] bg-[#0a0a0f] rounded-xl p-6 border border-blue-500/20">
      {/* Automotive Categories Section */}
      <Card className="bg-[#12121a] border-blue-500/20 mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-white flex items-center gap-2">
              <Tags className="h-5 w-5 text-blue-400" />
              Categorias Automotivas
              <Badge className="bg-blue-600/30 text-blue-300 border-blue-500/50 ml-2">
                {automotiveCategories.length}
              </Badge>
            </CardTitle>
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-4 w-4 mr-1" /> Nova Categoria
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0f0f18] border-blue-500/30 text-white">
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <Car className="h-5 w-5 text-blue-400" />
                    Nova Categoria Automotiva
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nome da categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    className="bg-[#12121a] border-blue-500/30 text-white"
                  />
                  <div className="flex space-x-2">
                    <Button 
                      onClick={handleAddCategory} 
                      disabled={savingCategory || !newCategoryName.trim()}
                      className="bg-blue-600 hover:bg-blue-500"
                    >
                      {savingCategory ? 'Salvando...' : 'Adicionar'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCategoryDialogOpen(false)}
                      className="border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {catLoading ? (
            <p className="text-blue-300/50">Carregando categorias...</p>
          ) : automotiveCategories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {automotiveCategories.map(cat => (
                <Badge 
                  key={cat.id} 
                  className="bg-blue-600/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 flex items-center gap-2"
                >
                  <Car className="h-3 w-3" />
                  {cat.name}
                  <button 
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="ml-1 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-blue-300/50">Nenhuma categoria automotiva. Adicione a primeira!</p>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#12121a] border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-300/70">
              Faturamento Automotivo
            </CardTitle>
            <DollarSign className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {statsLoading ? '...' : formatPrice(automotiveStats.totalRevenue)}
            </div>
            <p className="text-xs text-blue-300/50 mt-1">
              Total de vendas da categoria
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#12121a] border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-300/70">
              Produtos Vendidos
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {statsLoading ? '...' : automotiveStats.productsSold.reduce((sum, p) => sum + p.totalQuantity, 0)}
            </div>
            <p className="text-xs text-blue-300/50 mt-1">
              Unidades vendidas
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#12121a] border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-300/70">
              Mais Vendido
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-blue-400 truncate">
              {statsLoading ? '...' : (automotiveStats.productsSold[0]?.name || 'Nenhum')}
            </div>
            <p className="text-xs text-blue-300/50 mt-1">
              {statsLoading ? '' : (automotiveStats.productsSold[0] 
                ? `${automotiveStats.productsSold[0].totalQuantity} vendas` 
                : 'Sem vendas ainda')}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 rounded-xl border border-blue-500/30">
            <Car className="h-8 w-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-heading text-white flex items-center gap-2">
              Produtos Automotivos
              <Badge className="bg-blue-600/30 text-blue-400 border-blue-500/50 hover:bg-blue-600/40">
                {automotiveProducts.length} itens
              </Badge>
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-blue-300/60 text-sm">
                Gerencie sua linha de produtos para veículos
              </p>
              <div className="flex items-center gap-1 text-xs text-blue-300/50 bg-blue-500/10 px-2 py-0.5 rounded">
                <GripVertical className="h-3 w-3" />
                <span>Arraste para reorganizar</span>
              </div>
            </div>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => setEditingProduct(null)}
              className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-500/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f18] border-blue-500/30 text-white">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Car className="h-5 w-5 text-blue-400" />
                {editingProduct ? 'Editar Produto Automotivo' : 'Novo Produto Automotivo'}
              </DialogTitle>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              onSave={handleSaveProduct}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <AdminProductFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categories={automotiveCategories}
        resultCount={filteredAutomotiveProducts.length}
        totalCount={automotiveProducts.length}
      />

      {/* Products Grid with Drag and Drop */}
      {filteredAutomotiveProducts.length > 0 ? (
        <DraggableAdminGrid
          products={filteredAutomotiveProducts}
          onReorder={handleReorderProducts}
          onEdit={(product) => {
            setEditingProduct(product);
            setIsDialogOpen(true);
          }}
          onDelete={handleDeleteProduct}
        />
      ) : automotiveProducts.length > 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Nenhum produto encontrado
          </h3>
          <p className="text-blue-300/50 mb-6">
            Tente ajustar os filtros de busca
          </p>
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600/10 rounded-full mb-6 border border-blue-500/20">
            <Car className="h-10 w-10 text-blue-500/60" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Nenhum produto automotivo
          </h3>
          <p className="text-blue-300/50 mb-6 max-w-md mx-auto">
            Comece adicionando seu primeiro produto da linha automotiva
          </p>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Produto Automotivo
          </Button>
        </div>
      )}
    </div>
  );
};

export default AutomotiveProductsManager;
