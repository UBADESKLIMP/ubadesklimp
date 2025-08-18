import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';

const Products = () => {
  const { addToCart } = useCart();
  
  const products = [
    {
      id: 1,
      name: 'Detergente Multiuso Premium',
      description: 'Limpeza profunda para todas as superfícies',
      price: 'R$ 15,90',
      image: 'public/img/cloro-vmax-10-12int-ex.png',
      category: 'Detergentes'
    },
    {
      id: 2,
      name: 'Kit Limpeza Banheiro',
      description: 'Conjunto completo para higienização',
      price: 'R$ 45,90',
      image: '🧽',
      category: 'Kits'
    },
    {
      id: 3,
      name: 'Desinfetante Lavanda',
      description: 'Elimina 99,9% dos germes e bactérias',
      price: 'R$ 12,50',
      
      image: '🧴',
      category: 'Desinfetantes'
    },
    {
      id: 4,
      name: 'Sabão em Pó Concentrado',
      description: 'Máxima eficiência na lavagem',
      price: 'R$ 28,90',
      
      image: '📦',
      category: 'Sabões'
    },
    {
      id: 5,
      name: 'Limpador de Vidros',
      description: 'Transparência perfeita sem riscos',
      price: 'R$ 18,90',
      
      image: '✨',
      category: 'Especiais'
    },
    {
      id: 6,
      name: 'Álcool em Gel 70%',
      description: 'Higienização rápida das mãos',
      price: 'R$ 8,90',
      
      image: '🧴',
      category: 'Higiene'
    }
  ];

  const handleAddToCart = (product: typeof products[0]) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
    });
    
    toast({
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
    });
  };

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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <Card 
              key={product.id} 
              className="bg-gradient-card border-border hover-lift group animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="p-6">
                {/* Product Image/Icon */}
                <div className="text-6xl mb-4 text-center group-hover:scale-110 transition-transform duration-300">
                  {product.image}
                </div>

                {/* Category Badge */}
                <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full mb-3">
                  {product.category}
                </div>

                {/* Product Info */}
                <h3 className="text-xl font-heading text-foreground mb-2">
                  {product.name}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {product.description}
                </p>


                {/* Price and CTA */}
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-foreground">
                    {product.price}
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

        {/* View All CTA */}
        <div className="text-center mt-12">
          <Button className="btn-hero">
            Ver Todos os Produtos
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Products;