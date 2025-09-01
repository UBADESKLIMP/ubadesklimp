
import { useState } from 'react';
import { Plus, Edit3, Trash2, Package, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts } from '@/hooks/useProducts';
import { ProductWithVariations } from '@/types/product';
import ProductForm from '@/components/ProductForm';
import CategoryManager from '@/components/CategoryManager';

const Admin = () => {
  const { products, loading, createProduct, updateProduct, deleteProduct } = useProducts();
  const [editingProduct, setEditingProduct] = useState<ProductWithVariations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSaveProduct = async (productData: any) => {
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await createProduct(productData);
      }
      setEditingProduct(null);
      setIsDialogOpen(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h3 className="text-xl font-semibold mb-2">Carregando produtos...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-heading text-gradient">
              Painel Administrativo
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie os produtos e categorias da Ubadesklimp
            </p>
          </div>
        </div>

        {/* Tabs for Products and Categories */}
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="products" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Produtos</span>
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center space-x-2">
              <Tags className="h-4 w-4" />
              <span>Categorias</span>
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-heading">Produtos</h2>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingProduct(null)} className="bg-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Produto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
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

            {/* Products Grid */}
            {products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <Card key={product.id} className="hover:shadow-md transition-shadow overflow-hidden">
                    <div className="relative">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-48 object-cover"
                        />
                      ) : (
                        <div className="w-full h-48 bg-muted flex items-center justify-center text-4xl">
                          📦
                        </div>
                      )}
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => {
                            setEditingProduct(product);
                            setIsDialogOpen(true);
                          }}
                          className="bg-background/80 backdrop-blur-sm"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => handleDeleteProduct(product.id)}
                          className="bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{product.category}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {product.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <p className="text-lg font-bold text-primary">
                        {formatPrice(product.price)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
                <p className="text-muted-foreground mb-6">
                  Comece adicionando seu primeiro produto
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-primary">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Produto
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            <CategoryManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
