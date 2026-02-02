import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit3, Trash2, ArrowLeft, Wand2, ClipboardList, Car, LayoutDashboard, Star, Package, Tags, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductWithVariations } from '@/types/product';
import ProductForm from '@/components/ProductForm';
import CategoryManager from '@/components/CategoryManager';
import BackgroundRemover from '@/components/BackgroundRemover';
import OrdersManager from '@/components/OrdersManager';
import AutomotiveProductsManager from '@/components/AutomotiveProductsManager';
import AdminDashboard from '@/components/AdminDashboard';
import PriorityProductsManager from '@/components/PriorityProductsManager';
import DraggableAdminGrid from '@/components/DraggableAdminGrid';
import AdminProductFilters, { SortOption } from '@/components/AdminProductFilters';
import { normalizeText } from '@/lib/utils';

const Admin = () => {
  const { products, loading, createProduct, updateProduct, deleteProduct, updateDisplayOrder, refetch } = useProducts();
  const { categories: limpezaCategories } = useCategories('limpeza');
  const [editingProduct, setEditingProduct] = useState<ProductWithVariations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOption, setSortOption] = useState<'default' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'brand_asc'>('default');

  // Atualizar editingProduct quando products mudar
  useEffect(() => {
    if (editingProduct) {
      const updatedProduct = products.find(p => p.id === editingProduct.id);
      if (updatedProduct) {
        setEditingProduct(updatedProduct);
      }
    }
  }, [products]);

  const handleSaveProduct = async (productData: any) => {
    try {
      let savedProduct;
      const { fragrances, ...productPayload } = productData;
      
      if (editingProduct) {
        savedProduct = await updateProduct(editingProduct.id, productPayload);
        
        // Salvar fragrâncias se houver usando fetch direto ao Supabase
        if (fragrances && fragrances.length > 0) {
          const { supabase } = await import('@/integrations/supabase/client');
          
          // Primeiro, deletar todas as fragrâncias existentes para este produto
          await supabase
            .from('product_fragrances')
            .delete()
            .eq('product_id', editingProduct.id);

          // Depois, inserir as novas fragrâncias
          const fragrancesToInsert = fragrances.map((fragrance: any) => ({
            product_id: editingProduct.id,
            name: fragrance.name,
            description: fragrance.description || null,
            image_url: fragrance.image_url || null,
            available_literages: fragrance.available_literages || [],
            order_index: fragrance.order || 0
          }));

          await supabase
            .from('product_fragrances')
            .insert(fragrancesToInsert);

          // Atualizar o campo has_fragrances do produto
          await supabase
            .from('products')
            .update({ has_fragrances: fragrances.length > 0 })
            .eq('id', editingProduct.id);
        }
        
        // Refetch products para garantir que as mudanças aparecem
        await refetch();
      } else {
        savedProduct = await createProduct(productPayload);
        
        // Salvar fragrâncias para produto novo
        if (fragrances && fragrances.length > 0 && savedProduct?.id) {
          const { supabase } = await import('@/integrations/supabase/client');
          
          const fragrancesToInsert = fragrances.map((fragrance: any) => ({
            product_id: savedProduct.id,
            name: fragrance.name,
            description: fragrance.description || null,
            image_url: fragrance.image_url || null,
            available_literages: fragrance.available_literages || [],
            order_index: fragrance.order || 0
          }));

          await supabase
            .from('product_fragrances')
            .insert(fragrancesToInsert);

          // Atualizar o campo has_fragrances do produto
          await supabase
            .from('products')
            .update({ has_fragrances: true })
            .eq('id', savedProduct.id);
        }
        
        await refetch();
      }
      
      // Não fechar o dialog automaticamente para permitir edições contínuas
      // setEditingProduct(null);
      // setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteProduct(id);
    }
  };

  const handleReorderProducts = useCallback(async (reorderedProducts: ProductWithVariations[]) => {
    await updateDisplayOrder(reorderedProducts);
  }, [updateDisplayOrder]);

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'Preço não definido';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  // Filtrar produtos de limpeza
  const limpezaProducts = useMemo(() => 
    products.filter(p => (p.line_type ?? 'limpeza') === 'limpeza'),
    [products]
  );

  // Aplicar filtros de busca e categoria + ordenação (ignorando acentos)
  const filteredLimpezaProducts = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    let filtered = limpezaProducts.filter(product => {
      const matchesSearch = 
        normalizeText(product.name).includes(normalizedSearch) ||
        normalizeText(product.description || '').includes(normalizedSearch);
      
      const matchesCategory = 
        categoryFilter === 'all' || product.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });

    // Aplicar ordenação
    if (sortOption !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        switch (sortOption) {
          case 'price_asc':
            return (a.price || 0) - (b.price || 0);
          case 'price_desc':
            return (b.price || 0) - (a.price || 0);
          case 'name_asc':
            return a.name.localeCompare(b.name, 'pt-BR');
          case 'name_desc':
            return b.name.localeCompare(a.name, 'pt-BR');
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [limpezaProducts, searchTerm, categoryFilter, sortOption]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h3 className="text-xl font-semibold mb-2 text-white">Carregando produtos...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-heading text-white">
              Painel Administrativo
            </h1>
            <p className="text-blue-300/60 mt-2">
              Gerencie os produtos e categorias da Ubadesklimp
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/'}
            className="flex items-center space-x-2 border-blue-500/30 text-blue-300 hover:bg-blue-500/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar para o Site</span>
          </Button>
        </div>

        {/* Tabs for Products and Categories */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-8 bg-[#12121a] border border-blue-500/20">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
              <Package className="h-4 w-4" />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="automotive" className="flex items-center space-x-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-300/70">
              <Car className="h-4 w-4" />
              <span>Automotivo</span>
            </TabsTrigger>
            <TabsTrigger value="highlights" className="flex items-center space-x-2 data-[state=active]:bg-yellow-600/30 data-[state=active]:text-yellow-300 text-blue-300/70">
              <Star className="h-4 w-4" />
              <span>Destaques</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
              <ClipboardList className="h-4 w-4" />
              <span>Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
              <Tags className="h-4 w-4" />
              <span>Categorias</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center space-x-2 data-[state=active]:bg-blue-600/30 data-[state=active]:text-white text-blue-300/70">
              <Wand2 className="h-4 w-4" />
              <span>Ferramentas</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <AdminDashboard />
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-heading text-white">Produtos de Limpeza</h2>
                <div className="flex items-center gap-1 text-xs text-blue-300/50 bg-blue-500/10 px-2 py-1 rounded">
                  <GripVertical className="h-3 w-3" />
                  <span>Arraste para reorganizar</span>
                </div>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingProduct(null)} className="bg-blue-600 hover:bg-blue-500 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Produto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0f0f18] border-blue-500/30 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      {editingProduct ? 'Editar Produto' : 'Novo Produto'}
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
              categories={limpezaCategories}
              resultCount={filteredLimpezaProducts.length}
              totalCount={limpezaProducts.length}
              sortOption={sortOption}
              onSortChange={setSortOption}
            />

            {/* Products Grid - Apenas produtos de LIMPEZA com Drag and Drop */}
            {filteredLimpezaProducts.length > 0 ? (
              <DraggableAdminGrid
                products={filteredLimpezaProducts}
                onReorder={handleReorderProducts}
                onEdit={(product) => {
                  setEditingProduct(product);
                  setIsDialogOpen(true);
                }}
                onDelete={handleDeleteProduct}
              />
            ) : limpezaProducts.length > 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold mb-2 text-white">Nenhum produto encontrado</h3>
                <p className="text-blue-300/50 mb-6">
                  Tente ajustar os filtros de busca
                </p>
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold mb-2 text-white">Nenhum produto de limpeza encontrado</h3>
                <p className="text-blue-300/50 mb-6">
                  Comece adicionando seu primeiro produto de limpeza
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Automotive Tab */}
          <TabsContent value="automotive">
            <AutomotiveProductsManager />
          </TabsContent>

          {/* Highlights Tab */}
          <TabsContent value="highlights">
            <PriorityProductsManager 
              onEditProduct={(productId) => {
                const product = products.find(p => p.id === productId);
                if (product) {
                  setEditingProduct(product);
                  setIsDialogOpen(true);
                }
              }}
            />
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <OrdersManager />
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <CategoryManager />
          </TabsContent>

          {/* Tools Tab */}
          <TabsContent value="tools">
            <div className="max-w-2xl mx-auto">
              <BackgroundRemover />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
