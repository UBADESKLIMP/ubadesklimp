
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ProductWithVariations, ProductVariation, ProductFragrance } from '@/types/product';
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
  const [selectedFragrance, setSelectedFragrance] = useState<ProductFragrance | null>(null);

  // Atualiza a variação e fragrância selecionadas quando o produto muda
  useEffect(() => {
    if (product?.has_variations && product.variations?.length > 0) {
      setSelectedVariation(product.variations[0]);
    } else {
      setSelectedVariation(null);
    }

    if (product?.has_fragrances && product.fragrances?.length > 0) {
      setSelectedFragrance(product.fragrances[0]);
    } else {
      setSelectedFragrance(null);
    }
  }, [product]);

  const handleAddToCart = () => {
    if (!product) return;

    let productName = product.name;
    let productId = product.id;

    // Adicionar informações de variação ao nome
    if (product.has_variations && selectedVariation) {
      productName += ` - ${selectedVariation.literage}`;
      productId += `-${selectedVariation.id}`;
    }

    // Adicionar informações de fragrância ao nome
    if (product.has_fragrances && selectedFragrance) {
      productName += ` - ${selectedFragrance.name}`;
      productId += `-${selectedFragrance.id}`;
    }

    if (product.has_variations && selectedVariation) {
      addToCart({
        id: productId,
        name: productName,
        price: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(selectedVariation.price),
        category: product.category,
        variation: selectedVariation,
        fragrance: selectedFragrance,
        productId: product.id
      });
    } else if (!product.has_variations && product.price) {
      addToCart({
        id: productId,
        name: productName,
        price: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(product.price),
        category: product.category,
        fragrance: selectedFragrance
      });
    }

    toast({
      title: "Produto adicionado!",
      description: `${productName} foi adicionado ao carrinho.`,
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
    // Verificar qual tipo de variação controla a imagem
    const imageControlledBy = product?.image_controlled_by || 'volume'; // padrão para volume
    
    if (imageControlledBy === 'fragrance' && selectedFragrance?.image_url) {
      return selectedFragrance.image_url;
    }
    
    if (imageControlledBy === 'volume' && selectedVariation?.image_url) {
      return selectedVariation.image_url;
    }
    
    return product?.image_url;
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <div className="grid md:grid-cols-2 gap-8 p-6">
          {/* Imagem do produto */}
          <div className="space-y-4">
            <div className="relative w-full bg-white rounded-lg border border-border overflow-hidden">
              <div className="h-[600px] flex items-center justify-center p-4">
                {getCurrentImage() ? (
                  <img 
                    src={getCurrentImage()!} 
                    alt={product.name}
                    className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="text-6xl text-muted-foreground">📦</div>
                )}
              </div>
              
              {/* Priority Badge in Details */}
              {product.priority && (
                <div className="absolute top-4 left-4">
                  <div className="bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full shadow-lg">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      <span className="text-xs font-bold tracking-wider uppercase">
                        Produto Destaque
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Detalhes do produto */}
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">{product.name}</h3>
              <p className="text-sm text-primary font-medium uppercase tracking-wide">{product.category}</p>
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

            {/* Seleção de fragrância */}
            {product.has_fragrances && product.fragrances && product.fragrances.length > 0 && (
              <div className="space-y-3">
                <label className="font-medium">Escolha a fragrância:</label>
                <Select 
                  value={selectedFragrance?.id || ''} 
                  onValueChange={(value) => {
                    const fragrance = product.fragrances?.find(f => f.id === value);
                    setSelectedFragrance(fragrance || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fragrância" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.fragrances.map((fragrance) => (
                      <SelectItem key={fragrance.id} value={fragrance.id}>
                        {fragrance.name}
                        {fragrance.description && ` - ${fragrance.description}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
