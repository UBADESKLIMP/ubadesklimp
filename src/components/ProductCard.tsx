import { useState } from 'react';
import { ShoppingCart, Info, Star, Zap, Sparkles, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductWithVariations } from '@/types/product';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';
import { getHighlightTypeByCategory, HIGHLIGHT_CONFIGS, HighlightType } from '@/types/highlight';
interface ProductCardProps {
  product: ProductWithVariations;
  onShowDetails: (product: ProductWithVariations) => void;
  variant?: 'default' | 'automotive';
}
const ProductCard = ({
  product,
  onShowDetails,
  variant = 'default'
}: ProductCardProps) => {
  const { addToCart } = useCart();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const handleAddToCart = () => {
    // Verificar se está esgotado
    if ((product as any).out_of_stock) {
      toast({
        title: "Produto Esgotado",
        description: "Este produto está temporariamente indisponível.",
        variant: "destructive"
      });
      return;
    }

    // Se tem variações de litragem ou fragrâncias, abre os detalhes
    if ((product.has_variations && product.variations && product.variations.length > 0) || 
        (product.has_fragrances && product.fragrances && product.fragrances.length > 0)) {
      onShowDetails(product);
      toast({
        title: "Ver detalhes",
        description: "Selecione as opções desejadas."
      });
    } else if (product.price) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category,
        productId: product.id,
        image_url: product.image_url || undefined
      });
      toast({
        title: "Produto adicionado!",
        description: `${product.name} foi adicionado ao carrinho.`
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
    // Para produtos com variações, usar o menor preço das variações
    if (product.has_variations && product.variations && product.variations.length > 0) {
      const minPrice = Math.min(...product.variations.map(v => v.price));
      return minPrice;
    }
    // Para produtos sem variações ou com fragrâncias apenas, usar o preço base
    return product.price || 0;
  };
  const getCurrentImage = () => {
    // Sempre mostra a imagem principal do produto
    return product.image_url;
  };
  // Função para obter o ícone baseado no tipo de destaque
  const getHighlightIcon = (type: HighlightType) => {
    switch (type) {
      case 'bestseller':
        return <Crown className="h-3 w-3" />;
      case 'promotion':
        return <Zap className="h-3 w-3" />;
      case 'new':
        return <Sparkles className="h-3 w-3" />;
      case 'featured':
        return <Star className="h-3 w-3" />;
      default:
        return <Star className="h-3 w-3" />;
    }
  };

  // Usar o tipo de destaque do produto ou fallback para categoria
  const productHighlightType = product.highlight_type === 'none' ? null : product.highlight_type;
  const highlightType = productHighlightType as HighlightType || getHighlightTypeByCategory(product.category);
  const highlightConfig = HIGHLIGHT_CONFIGS[highlightType];
  
  // Só mostrar destaque se o produto for prioritário e não for "none"
  const shouldShowHighlight = product.priority && productHighlightType !== null;

  const getCurrentHighlight = () => {
    if (!shouldShowHighlight) return null;
    return highlightConfig;
  };

  // Automotive variant styles
  const cardClasses = variant === 'automotive' 
    ? 'bg-[#0d1829] border-blue-500/30 hover-lift group animate-slide-up overflow-hidden h-full flex flex-col'
    : 'bg-gradient-card border-border hover-lift group animate-slide-up overflow-hidden h-full flex flex-col';

  const textForegroundClass = variant === 'automotive' ? 'text-white' : 'text-foreground';
  const textMutedClass = variant === 'automotive' ? 'text-blue-300/70' : 'text-muted-foreground';

  return <Card className={cardClasses}>
      <div className="flex flex-col h-full">
        {/* Product Image */}
        <div className={`relative ${variant === 'automotive' ? 'h-56' : 'h-48'} w-full overflow-hidden bg-muted/50 flex items-center justify-center ${variant === 'automotive' ? '' : 'p-4'} cursor-pointer`} onClick={() => onShowDetails(product)}>
          {getCurrentImage() && !imageError ? (
            <>
              {/* Blur placeholder while loading */}
              <div 
                className={`absolute inset-0 bg-gradient-to-br from-primary/5 via-muted to-primary/10 transition-opacity duration-500 ${
                  imageLoaded ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {/* Blurred preview using same image */}
                <img 
                  src={getCurrentImage()!} 
                  alt="" 
                  aria-hidden="true"
                  className="w-full h-full object-cover scale-110 blur-xl opacity-50"
                />
                {/* Shimmer overlay */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  style={{ 
                    animation: imageLoaded ? 'none' : 'shimmer 1.5s infinite',
                  }}
                />
              </div>
              {/* Main image - zoom para automotivo */}
              <img 
                src={getCurrentImage()!} 
                alt={product.name} 
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`transition-all duration-700 ease-out ${
                  variant === 'automotive'
                    ? `w-full h-full object-cover scale-125 group-hover:scale-[1.35] ${imageLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`
                    : `max-w-full max-h-full object-contain group-hover:scale-105 ${imageLoaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-105'}`
                }`}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-muted to-muted/50">
              📦
            </div>
          )}
          
          {/* Dynamic Priority Badge */}
          {(() => {
            const highlight = getCurrentHighlight();
            if (!highlight) return null;
            
            return (
              <div className="absolute -top-1 -left-1 z-10">
                <div className="relative">
                  <div className={`bg-gradient-to-r ${highlight.gradient} text-white px-4 py-2 rounded-br-2xl rounded-tl-lg shadow-lg backdrop-blur-sm border border-white/20`}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      {getHighlightIcon(highlight.type)}
                      <span className="text-xs font-bold tracking-wider uppercase">
                        {highlight.label}
                      </span>
                    </div>
                  </div>
                  <div className={`absolute inset-0 bg-gradient-to-r ${highlight.gradient} rounded-br-2xl rounded-tl-lg blur-sm opacity-40 -z-10`}></div>
                </div>
              </div>
            );
          })()}
          
          {/* Category Badge */}
          <div className="absolute top-2 right-2">
            <div className="inline-block px-2 py-1 bg-primary/90 backdrop-blur-sm text-primary-foreground text-xs font-medium rounded-full shadow-medium">
              {product.category}
            </div>
          </div>

          {/* Out of Stock Badge */}
          {(product as any).out_of_stock && (
            <div className="absolute bottom-2 right-2 bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-bold shadow-lg">
              ESGOTADO
            </div>
          )}

          {/* Details Button */}
          <Button 
            variant="secondary" 
            size="sm" 
            className={`absolute ${product.priority ? 'bottom-2' : 'top-2'} left-2 opacity-0 group-hover:opacity-100 transition-opacity`} 
            onClick={() => onShowDetails(product)}
          >
            <Info className="h-3 w-3 mr-1" />
            Detalhes
          </Button>
        </div>

        {/* Product Info */}
        <div className="p-4 flex-1 flex flex-col">
          {/* Nome do produto - altura fixa */}
          <div className="h-14">
            <h3 className={`text-lg font-heading ${textForegroundClass} line-clamp-2 leading-tight`}>
              {product.name}
            </h3>
          </div>

          {/* Descrição expandida - altura fixa maior */}
          {product.description && <div className="h-20 mb-4">
              <p className={`${textMutedClass} text-sm line-clamp-4 leading-relaxed`}>
                {product.description}
              </p>
            </div>}
          
          {/* Detalhes Técnicos Automotivos */}
          {(product.action_type || product.ph_level || product.application_area) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {product.action_type && (
                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                  {product.action_type}
                </span>
              )}
              {product.ph_level && (
                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                  PH: {product.ph_level}
                </span>
              )}
              {product.application_area && (
                <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                  {product.application_area}
                </span>
              )}
            </div>
          )}

          {/* Espaçador flexível */}
          <div className="flex-1"></div>

          {/* Indicador de variações disponíveis */}
          {product.has_variations && <div className="mb-4">
              
            </div>}

          {/* Price and CTA - sempre na parte inferior */}
          <div className="flex items-center justify-between mt-auto">
            <span className={`text-xl font-bold ${textForegroundClass}`}>
              {(product as any).out_of_stock ? 'Em Falta' : 
                (getCurrentPrice() > 0 ? 
                  (product.has_variations && product.variations && product.variations.length > 0 ? 
                    `A partir de ${formatPrice(getCurrentPrice())}` : 
                    formatPrice(getCurrentPrice())
                  ) : 'Indisponível'
                )
              }
            </span>
            <Button 
              size="sm" 
              className="btn-secondary"
              onClick={handleAddToCart} 
              disabled={getCurrentPrice() === 0 || (product as any).out_of_stock}
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              {(product as any).out_of_stock ? 'Esgotado' : 
                ((product.has_variations && product.variations && product.variations.length > 0) || 
                 (product.has_fragrances && product.fragrances && product.fragrances.length > 0) ? 
                  'Ver opções' : 'Adicionar'
                )
              }
            </Button>
          </div>
        </div>
      </div>
    </Card>;
};
export default ProductCard;