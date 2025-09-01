
import { ShoppingCart, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProductWithVariations } from '@/types/product';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';

interface ProductCardProps {
  product: ProductWithVariations;
  onShowDetails: (product: ProductWithVariations) => void;
}

const ProductCard = ({ product, onShowDetails }: ProductCardProps) => {
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    if (product.has_variations) {
      // Para produtos com variações, redireciona para detalhes
      onShowDetails(product);
      toast({
        title: "Ver detalhes",
        description: "Clique em uma variação para adicionar ao carrinho.",
      });
    } else if (product.price) {
      addToCart({
        id: product.id,
        name: product.name,
        price: formatPrice(product.price),
        category: product.category
      });
      toast({
        title: "Produto adicionado!",
        description: `${product.name} foi adicionado ao carrinho.`,
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getCurrentPrice = () => {
    // Sempre mostra o preço base do produto
    return product.price || 0;
  };

  const getCurrentImage = () => {
    // Sempre mostra a imagem principal do produto
    return product.image_url;
  };

  return (
    <Card className="bg-gradient-card border-border hover-lift group animate-slide-up overflow-hidden h-full flex flex-col">
      <div className="flex flex-col h-full">
        {/* Product Image */}
        <div className="relative h-48 w-full overflow-hidden bg-muted/50 flex items-center justify-center p-4">
          {getCurrentImage() ? (
            <img 
              src={getCurrentImage()!} 
              alt={product.name}
              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-muted to-muted/50">
              📦
            </div>
          )}
          
          {/* Category Badge */}
          <div className="absolute top-2 right-2">
            <div className="inline-block px-2 py-1 bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-medium rounded-full shadow-medium">
              {product.category}
            </div>
          </div>

          {/* Details Button */}
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onShowDetails(product)}
          >
            <Info className="h-3 w-3 mr-1" />
            Detalhes
          </Button>
        </div>

        {/* Product Info */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Nome do produto - altura fixa */}
          <div className="h-14 mb-3">
            <h3 className="text-lg font-heading text-foreground line-clamp-2 leading-tight">
              {product.name}
            </h3>
          </div>

          {/* Descrição expandida - altura fixa maior */}
          {product.description && (
            <div className="h-20 mb-4">
              <p className="text-muted-foreground text-sm line-clamp-4 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Espaçador flexível */}
          <div className="flex-1"></div>

          {/* Indicador de variações disponíveis */}
          {product.has_variations && (
            <div className="mb-4">
              <div className="bg-secondary/50 border border-border rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  Variações disponíveis - Clique em "Ver detalhes"
                </p>
              </div>
            </div>
          )}

          {/* Price and CTA - sempre na parte inferior */}
          <div className="flex items-center justify-between mt-auto">
            <span className="text-xl font-bold text-foreground">
              {getCurrentPrice() > 0 ? formatPrice(getCurrentPrice()) : 'Indisponível'}
            </span>
            <Button 
              size="sm"
              className="btn-secondary"
              onClick={handleAddToCart}
              disabled={getCurrentPrice() === 0}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              {product.has_variations ? 'Ver opções' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProductCard;
