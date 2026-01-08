import { useState } from 'react';
import { Plus, Edit3, Trash2, Car, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useProducts } from '@/hooks/useProducts';
import { ProductWithVariations } from '@/types/product';
import ProductForm from '@/components/ProductForm';
import { supabase } from '@/integrations/supabase/client';

const AutomotiveProductsManager = () => {
  const { products, loading, createProduct, updateProduct, deleteProduct, refetch } = useProducts();
  const [editingProduct, setEditingProduct] = useState<ProductWithVariations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filtrar apenas produtos automotivos
  const automotiveProducts = products.filter(
    (product) => product.category?.toLowerCase() === 'automotivo'
  );

  const handleSaveProduct = async (productData: any) => {
    try {
      const { fragrances, ...productPayload } = productData;
      // Forçar categoria automotivo
      productPayload.category = 'automotivo';

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

  const formatPrice = (price: number | undefined) => {
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

  return (
    <div className="min-h-[500px] bg-[#0a0a0f] rounded-xl p-6 border border-blue-500/20">
      {/* Header */}
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
            <p className="text-blue-300/60 text-sm mt-1">
              Gerencie sua linha de produtos para veículos
            </p>
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

      {/* Products Grid */}
      {automotiveProducts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {automotiveProducts.map((product) => (
            <Card
              key={product.id}
              className="bg-[#12121a] border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 overflow-hidden group hover:shadow-xl hover:shadow-blue-500/10"
            >
              <div className="relative">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-40 bg-blue-900/20 flex items-center justify-center">
                    <Package className="h-12 w-12 text-blue-500/40" />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-transparent to-transparent" />
                
                {/* Action buttons */}
                <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => {
                      setEditingProduct(product);
                      setIsDialogOpen(true);
                    }}
                    className="bg-blue-600/80 hover:bg-blue-500 text-white border-0 backdrop-blur-sm h-8 w-8"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={() => handleDeleteProduct(product.id)}
                    className="bg-red-600/80 hover:bg-red-500 text-white border-0 backdrop-blur-sm h-8 w-8"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base text-white line-clamp-1">
                  {product.name}
                </CardTitle>
              </CardHeader>

              <CardContent className="pt-0">
                {product.description && (
                  <p className="text-sm text-blue-300/50 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-lg font-bold text-blue-400">
                    {formatPrice(product.price)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
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
