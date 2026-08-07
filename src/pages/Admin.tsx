import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Package, Search, Loader2, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductWithVariations } from '@/types/product';
import ProductForm from '@/components/ProductForm';
import CategoryManager from '@/components/CategoryManager';
import OrdersManager from '@/components/OrdersManager';
import AutomotiveProductsManager from '@/components/AutomotiveProductsManager';
import AdminDashboard from '@/components/AdminDashboard';
import PriorityProductsManager from '@/components/PriorityProductsManager';
import StaffManager from '@/components/StaffManager';
import SupplierManager from '@/components/SupplierManager';
import { useStaffAccess } from '@/hooks/useStaffAccess';
import DraggableAdminGrid from '@/components/DraggableAdminGrid';
import AdminProductFilters, { SortOption } from '@/components/AdminProductFilters';
import { normalizeText } from '@/lib/utils';
import AdminShell from '@/components/admin/AdminShell';
import AdminHome from '@/components/admin/AdminHome';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import AdminEmptyState from '@/components/admin/AdminEmptyState';
import AdminComingSoon from '@/components/admin/AdminComingSoon';
import { AdminSection, getVisibleNavItems } from '@/components/admin/adminNav';

const Admin = () => {
  const { products, loading, createProduct, updateProduct, deleteProduct, updateDisplayOrder, refetch } = useProducts();
  const { categories: limpezaCategories } = useCategories('limpeza');
  const staffAccess = useStaffAccess();

  const [activeSection, setActiveSection] = useState<AdminSection>('home');
  const visibleNavItems = useMemo(() => getVisibleNavItems(staffAccess), [staffAccess]);

  const [editingProduct, setEditingProduct] = useState<ProductWithVariations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Estados para filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('default');

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

        if (fragrances && fragrances.length > 0) {
          const { supabase } = await import('@/integrations/supabase/client');

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

          await supabase
            .from('product_fragrances')
            .insert(fragrancesToInsert);

          await supabase
            .from('products')
            .update({ has_fragrances: fragrances.length > 0 })
            .eq('id', editingProduct.id);
        }

        await refetch();
      } else {
        savedProduct = await createProduct(productPayload);

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
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteProduct(id);
    }
  };

  const handleReorderProducts = useCallback(async (reorderedProducts: ProductWithVariations[]) => {
    await updateDisplayOrder(reorderedProducts);
  }, [updateDisplayOrder]);

  const limpezaProducts = useMemo(() =>
    products.filter(p => (p.line_type ?? 'limpeza') === 'limpeza'),
    [products]
  );

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

  if (loading || staffAccess.loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-blue-300/60">Carregando painel...</p>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <AdminHome staffAccess={staffAccess} onNavigate={setActiveSection} />;

      case 'financeiro':
        return <AdminDashboard />;

      case 'orders':
        return <OrdersManager />;

      case 'products':
        return (
          <div>
            <AdminPageHeader
              title="Produtos de Limpeza"
              description="Arraste para reorganizar a ordem de exibição na vitrine."
              action={
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
              }
            />

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
              <AdminEmptyState
                icon={Search}
                title="Nenhum produto encontrado"
                description="Tente ajustar os filtros de busca"
              />
            ) : (
              <AdminEmptyState
                icon={Package}
                title="Nenhum produto de limpeza encontrado"
                description="Comece adicionando seu primeiro produto de limpeza"
                action={
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Produto
                  </Button>
                }
              />
            )}
          </div>
        );

      case 'automotive':
        return <AutomotiveProductsManager />;

      case 'highlights':
        return (
          <PriorityProductsManager
            onEditProduct={(productId) => {
              const product = products.find(p => p.id === productId);
              if (product) {
                setEditingProduct(product);
                setIsDialogOpen(true);
              }
            }}
          />
        );

      case 'categories':
        return <CategoryManager />;

      case 'suppliers':
        return <SupplierManager />;

      case 'missing':
        return (
          <AdminComingSoon
            icon={ClipboardCheck}
            title="Faltantes"
            description="Em breve você vai poder registrar produtos faltantes e gerar cotações automaticamente."
          />
        );

      case 'staff':
        return <StaffManager />;

      default:
        return null;
    }
  };

  return (
    <AdminShell items={visibleNavItems} activeSection={activeSection} onSelectSection={setActiveSection}>
      {renderSection()}
    </AdminShell>
  );
};

export default Admin;
