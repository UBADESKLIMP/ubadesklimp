
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, X } from 'lucide-react';
import { useState } from 'react';
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
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(
    product?.variations?.[0] || null
  );

  const handleAddToCart = () => {
    if (!product || !selectedVariation) return;

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

    toast({
      title: "Produto adicionado!",
      description: `${product.name} (${selectedVariation.literage}) foi adicionado ao carrinho.`,
    });

    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading">{product.name}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Imagem do produto */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted/50 rounded-lg flex items-center justify-center overflow-hidden">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-6xl">📦</div>
              )}
            </div>
          </div>

          {/* Detalhes do produto */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
              {product.description && (
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            {/* Especificações */}
            <div className="space-y-3">
              <h4 className="font-semibold text-lg">Especificações:</h4>
              <div className="space-y-2">
                {product.material && (
                  <div className="flex justify-between">
                    <span className="font-medium">Material:</span>
                    <span>{product.material}</span>
                  </div>
                )}
                {selectedVariation && (
                  <div className="flex justify-between">
                    <span className="font-medium">Litragem:</span>
                    <span>{selectedVariation.literage}</span>
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
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {product.specifications}
                  </p>
                </div>
              )}
            </div>

            {/* Seleção de variação */}
            {product.variations && product.variations.length > 1 && (
              <div className="space-y-2">
                <label className="font-medium">Escolha a litragem:</label>
                <Select 
                  value={selectedVariation?.id} 
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
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-primary">
                  {selectedVariation ? formatPrice(selectedVariation.price) : 'Selecione uma opção'}
                </span>
              </div>
              
              <Button 
                onClick={handleAddToCart} 
                className="w-full btn-secondary"
                disabled={!selectedVariation}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
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
