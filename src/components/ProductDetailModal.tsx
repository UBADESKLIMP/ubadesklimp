
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ProductWithVariations, ProductVariation } from '@/types/product';
import { useCart } from '@/contexts/CartContext';
import { toast } from '@/hooks/use-toast';

interface ProductDetailModalProps {
  product: ProductWithVariations | null;
  isOpen: boolean;
  onClose: () => void;
}

const ProductDetailModal = ({ product, isOpen, onClose }: ProductDetailModalProps) => {
  const { addToCart } = useCart();
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);

  // Atualiza a variação selecionada quando o produto muda
  useEffect(() => {
    if (product?.has_variations && product.variations?.length > 0) {
      setSelectedVariation(product.variations[0]);
    } else {
      setSelectedVariation(null);
    }
  }, [product]);

  const handleAddToCart = () => {
    if (!product) return;

    if (product.has_variations && selectedVariation) {
      addToCart({
        id: `${product.id}-${selectedVariation.id}`,
        name: `${product.name} - ${selectedVariation.literage}`,
        price: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(selectedVariation.price),
        category: product.category,
        variation: selectedVariation
      });
    } else if (!product.has_variations && product.price) {
      addToCart({
        id: product.id,
        name: product.name,
        price: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(product.price),
        category: product.category
      });
    }

    toast({
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
    });

    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getCurrentPrice = () => {
    if (product?.has_variations && selectedVariation) {
      return selectedVariation.price;
    }
    if (!product?.has_variations && product?.price) {
      return product.price;
    }
    return 0;
  };

  const getCurrentImage = () => {
    if (product?.has_variations && selectedVariation?.image_url) {
      return selectedVariation.image_url;
    }
    return product?.image_url;
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0 relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4 h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogTitle className="text-2xl font-heading pr-8">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-8 p-6">
          {/* Imagem do produto */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden border border-border p-8">
              {getCurrentImage() ? (
                <img 
                  src={getCurrentImage()!} 
                  alt={product.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-6xl text-muted-foreground">📦</div>
              )}
            </div>
          </div>

          {/* Detalhes do produto */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-3">{product.name}</h3>
              {product.description && (
                <p className="text-muted-foreground leading-relaxed mb-4">
                  {product.description}
                </p>
              )}
            </div>

            {/* Especificações */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Especificações:</h4>
              <div className="space-y-3 bg-muted/30 p-4 rounded-lg">
                {product.material && (
                  <div className="flex justify-between">
                    <span className="font-medium">Material:</span>
                    <span>{product.material}</span>
                  </div>
                )}
                {product.has_variations && selectedVariation ? (
                  <div className="flex justify-between">
                    <span className="font-medium">Litragem:</span>
                    <span>{selectedVariation.literage}</span>
                  </div>
                ) : !product.has_variations && (
                  <div className="flex justify-between">
                    <span className="font-medium">Litragem:</span>
                    <span>Tamanho único</span>
                  </div>
                )}
                {product.validity && (
                  <div className="flex justify-between">
                    <span className="font-medium">Validade:</span>
                    <span>{product.validity}</span>
                  </div>
                )}
              </div>
              {product.specifications && (
                <div>
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded">
                    {product.specifications}
                  </p>
                </div>
              )}
            </div>

            {/* Seleção de variação */}
            {product.has_variations && product.variations && product.variations.length > 0 && (
              <div className="space-y-3">
                <label className="font-medium">Escolha a litragem:</label>
                <Select 
                  value={selectedVariation?.id || ''} 
                  onValueChange={(value) => {
                    const variation = product.variations.find(v => v.id === value);
                    setSelectedVariation(variation || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a litragem" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.variations.map((variation) => (
                      <SelectItem key={variation.id} value={variation.id}>
                        {variation.literage} - {formatPrice(variation.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preço e botão de compra */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-3xl font-bold text-primary">
                  {getCurrentPrice() > 0 ? formatPrice(getCurrentPrice()) : 'Indisponível'}
                </span>
              </div>
              
              <Button 
                onClick={handleAddToCart} 
                className="w-full btn-secondary text-lg py-3"
                disabled={getCurrentPrice() === 0}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Comprar Agora
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;
