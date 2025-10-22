
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

  // Determinar se o preço/botão deve aparecer abaixo da imagem
  const showButtonBelowImage = product?.price_position === 'below_image';

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

  // Reset variação quando fragrância muda para garantir compatibilidade
  useEffect(() => {
    if (product?.has_variations && product.variations && selectedFragrance) {
      // Filtrar variações disponíveis para a fragrância selecionada
      const availableVariations = product.variations.filter((variation) => {
        if (selectedFragrance.available_literages && selectedFragrance.available_literages.length > 0) {
          return selectedFragrance.available_literages.includes(variation.literage);
        }
        return true;
      });
      
      // Se a variação atual não está disponível, selecionar a primeira disponível
      if (selectedVariation && availableVariations.length > 0) {
        const isCurrentVariationAvailable = availableVariations.some(v => v.id === selectedVariation.id);
        if (!isCurrentVariationAvailable) {
          setSelectedVariation(availableVariations[0]);
        }
      } else if (availableVariations.length > 0) {
        setSelectedVariation(availableVariations[0]);
      }
    }
  }, [selectedFragrance, product]);

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

    // Se tem variações cadastradas e uma está selecionada
    if (product.has_variations && product.variations?.length > 0 && selectedVariation) {
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
    } else if (product.price) {
      // Usar preço base se não tem variações OU se tem has_variations mas sem variações cadastradas
      addToCart({
        id: productId,
        name: productName,
        price: new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(product.price),
        category: product.category,
        fragrance: selectedFragrance,
        productId: product.id
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
    // Se tem variações cadastradas e uma está selecionada
    if (product?.has_variations && product?.variations?.length > 0 && selectedVariation) {
      return selectedVariation.price;
    }
    // Se não tem variações OU tem has_variations mas sem variações cadastradas, usar preço base
    if (product?.price) {
      return product.price;
    }
    return 0;
  };

  const getCurrentImage = () => {
    // Prioridade: fragrância selecionada > variação selecionada > imagem principal do produto
    if (selectedFragrance?.image_url) {
      return selectedFragrance.image_url;
    }
    if (selectedVariation?.image_url) {
      return selectedVariation.image_url;
    }
    if (product?.image_url) {
      return product.image_url;
    }
    return null;
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

            {/* Seleções e botão de compra - visível quando conteúdo é grande */}
            {showButtonBelowImage && (
              <div className="border-t pt-6 space-y-4">
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
                    <label className="font-medium">
                      {product.variations[0]?.literage.match(/cm/i) ? 'Escolha o tamanho:' : 
                       product.variations[0]?.literage.match(/kg|g/i) ? 'Escolha o peso:' : 
                       product.variations[0]?.literage.match(/unidade/i) ? 'Escolha a quantidade:' : 'Escolha o volume:'}
                    </label>
                    <Select 
                      value={selectedVariation?.id || ''} 
                      onValueChange={(value) => {
                        const variation = product.variations.find(v => v.id === value);
                        setSelectedVariation(variation || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={
                          product.variations[0]?.literage.match(/cm/i) ? 'Selecione o tamanho' : 
                          product.variations[0]?.literage.match(/kg|g/i) ? 'Selecione o peso' : 
                          product.variations[0]?.literage.match(/unidade/i) ? 'Selecione a quantidade' : 'Selecione o volume'
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {product.variations
                          .filter((variation) => {
                            if (selectedFragrance?.available_literages && selectedFragrance.available_literages.length > 0) {
                              return selectedFragrance.available_literages.includes(variation.literage);
                            }
                            return true;
                          })
                          .map((variation) => (
                            <SelectItem key={variation.id} value={variation.id}>
                              {variation.literage} - {formatPrice(variation.price)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(product as any).out_of_stock && (
                  <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-center">
                    <span className="text-destructive font-semibold">⚠️ Produto Esgotado</span>
                    <p className="text-sm text-muted-foreground mt-1">Este produto está temporariamente indisponível</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-primary">
                    {(product as any).out_of_stock ? 'Em Falta' : 
                      (getCurrentPrice() > 0 ? formatPrice(getCurrentPrice()) : 'Indisponível')
                    }
                  </span>
                </div>
                
                <Button 
                  onClick={handleAddToCart} 
                  className="w-full btn-secondary text-lg py-3"
                  disabled={getCurrentPrice() === 0 || (product as any).out_of_stock}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {(product as any).out_of_stock ? 'Produto Esgotado' : 'Comprar Agora'}
                </Button>
              </div>
            )}
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
                    <span className="text-muted-foreground">{product.material}</span>
                  </div>
                )}
                {product.has_variations && selectedVariation ? (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {product.size_unit === 'litros' || product.size_unit === 'ml' ? 'Volume:' :
                       product.size_unit === 'kg' || product.size_unit === 'g' ? 'Peso:' :
                       product.size_unit === 'cm' ? 'Tamanho:' :
                       product.size_unit === 'unidades' ? 'Quantidade:' :
                       selectedVariation.literage.match(/cm/i) ? 'Tamanho:' : 
                       selectedVariation.literage.match(/kg|g/i) ? 'Peso:' : 
                       selectedVariation.literage.match(/unidade/i) ? 'Quantidade:' : 'Volume:'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{selectedVariation.literage}</span>
                      {(product.size_unit === 'litros' || product.size_unit === 'ml') && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>
                      )}
                      {(product.size_unit === 'kg' || product.size_unit === 'g') && (
                        <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">⚖️ Peso</span>
                      )}
                      {product.size_unit === 'cm' && (
                        <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">📏 Tamanho</span>
                      )}
                      {product.size_unit === 'unidades' && (
                        <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📦 Unidades</span>
                      )}
                    </div>
                  </div>
                ) : !product.has_variations && (product as any).literage_single && (
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {product.size_unit === 'litros' || product.size_unit === 'ml' ? 'Volume:' :
                       product.size_unit === 'kg' || product.size_unit === 'g' ? 'Peso:' :
                       product.size_unit === 'cm' ? 'Tamanho:' :
                       product.size_unit === 'unidades' ? 'Quantidade:' :
                       (product as any).literage_single.match(/cm/i) ? 'Tamanho:' : 
                       (product as any).literage_single.match(/kg|g/i) ? 'Peso:' : 
                       (product as any).literage_single.match(/unidade/i) ? 'Quantidade:' : 'Volume:'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span>{(product as any).literage_single}</span>
                      {(product.size_unit === 'litros' || product.size_unit === 'ml') && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full">💧 Volume</span>
                      )}
                      {(product.size_unit === 'kg' || product.size_unit === 'g') && (
                        <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">⚖️ Peso</span>
                      )}
                      {product.size_unit === 'cm' && (
                        <span className="text-xs bg-orange-500/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">📏 Tamanho</span>
                      )}
                      {product.size_unit === 'unidades' && (
                        <span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">📦 Unidades</span>
                      )}
                    </div>
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
                  <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded whitespace-pre-wrap">
                    {product.specifications}
                  </p>
                </div>
              )}
            </div>

            {/* Especificações */}
            <div className="space-y-4 border-t pt-4">
            </div>

            {/* Seleção de fragrância */}
            {!showButtonBelowImage && product.has_fragrances && product.fragrances && product.fragrances.length > 0 && (
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
            {!showButtonBelowImage && product.has_variations && product.variations && product.variations.length > 0 && (
              <div className="space-y-3">
                <label className="font-medium">
                  {product.variations[0]?.literage.match(/cm/i) ? 'Escolha o tamanho:' : 
                   product.variations[0]?.literage.match(/kg|g/i) ? 'Escolha o peso:' : 
                   product.variations[0]?.literage.match(/unidade/i) ? 'Escolha a quantidade:' : 'Escolha o volume:'}
                </label>
                <Select 
                  value={selectedVariation?.id || ''} 
                  onValueChange={(value) => {
                    const variation = product.variations.find(v => v.id === value);
                    setSelectedVariation(variation || null);
                  }}
                >
                  <SelectTrigger>
                        <SelectValue placeholder={
                          product.variations[0]?.literage.match(/cm/i) ? 'Selecione o tamanho' : 
                          product.variations[0]?.literage.match(/kg|g/i) ? 'Selecione o peso' : 
                          product.variations[0]?.literage.match(/unidade/i) ? 'Selecione a quantidade' : 'Selecione o volume'
                        } />
                  </SelectTrigger>
                  <SelectContent>
                    {product.variations
                      .filter((variation) => {
                        // Se há fragrância selecionada e ela tem litragens específicas, filtrar
                        if (selectedFragrance?.available_literages && selectedFragrance.available_literages.length > 0) {
                          return selectedFragrance.available_literages.includes(variation.literage);
                        }
                        // Se não há restrição de litragens, mostrar todas
                        return true;
                      })
                      .map((variation) => (
                        <SelectItem key={variation.id} value={variation.id}>
                          {variation.literage} - {formatPrice(variation.price)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Preço e botão de compra - visível quando conteúdo é pequeno */}
            {!showButtonBelowImage && (
              <div className="border-t pt-6">
                {(product as any).out_of_stock && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-lg text-center">
                    <span className="text-destructive font-semibold">⚠️ Produto Esgotado</span>
                    <p className="text-sm text-muted-foreground mt-1">Este produto está temporariamente indisponível</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-6">
                  <span className="text-3xl font-bold text-primary">
                    {(product as any).out_of_stock ? 'Em Falta' : 
                      (getCurrentPrice() > 0 ? formatPrice(getCurrentPrice()) : 'Indisponível')
                    }
                  </span>
                </div>
                
                <Button 
                  onClick={handleAddToCart} 
                  className="w-full btn-secondary text-lg py-3"
                  disabled={getCurrentPrice() === 0 || (product as any).out_of_stock}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {(product as any).out_of_stock ? 'Produto Esgotado' : 'Comprar Agora'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;
