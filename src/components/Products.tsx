
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/useProducts';

const Products = () => {
  const { addToCart } = useCart();
  const { products, loading } = useProducts();

  const handleAddToCart = (product: any) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(product.price),
      category: product.category,
    });
    
    toast({
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (loading) {
    return (
      <section id="products" className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
              Nossos <span className="text-gradient">Produtos</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Carregando nossos produtos...
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="bg-gradient-card border-border animate-pulse">
                <div className="p-6">
                  <div className="w-16 h-16 bg-muted rounded mx-auto mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-6 bg-muted rounded mb-4"></div>
                  <div className="h-4 bg-muted rounded mb-4"></div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 w-20 bg-muted rounded"></div>
                    <div className="h-10 w-24 bg-muted rounded"></div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="products" className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-5xl font-heading text-foreground mb-4">
            Nossos <span className="text-gradient">Produtos</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Selecionamos os melhores produtos de limpeza para garantir resultados excepcionais
          </p>
        </div>

        {/* Products Grid */}
        {products.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <Card 
                key={product.id} 
                className="bg-gradient-card border-border hover-lift group animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="p-6">
                  {/* Product Image */}
                  <div className="mb-4 text-center group-hover:scale-110 transition-transform duration-300">
                    {product.image_url ? (
                      <img 
                        src={product.image_url} 
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded mx-auto"
                      />
                    ) : (
                      <div className="text-6xl">📦</div>
                    )}
                  </div>

                  {/* Category Badge */}
                  <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full mb-3">
                    {product.category}
                  </div>

                  {/* Product Info */}
                  <h3 className="text-xl font-heading text-foreground mb-2">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-muted-foreground mb-4">
                      {product.description}
                    </p>
                  )}

                  {/* Price and CTA */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">
                      {formatPrice(product.price)}
                    </span>
                    <Button 
                      className="btn-secondary"
                      onClick={() => handleAddToCart(product)}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold mb-2">Em breve novos produtos</h3>
            <p className="text-muted-foreground">
              Estamos preparando produtos incríveis para você!
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Products;
