
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCart } from '@/contexts/CartContext';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import WhatsAppIcon from './WhatsAppIcon';
import { ProductVariation } from '@/types/product';
import { useProducts } from '@/hooks/useProducts';

const Cart = () => {
  const { state, updateQuantity, updateVariation, removeFromCart, clearCart, getWhatsAppLink } = useCart();
  const { products } = useProducts();

  const handleWhatsAppOrder = () => {
    const link = getWhatsAppLink();
    if (link) {
      window.open(link, '_blank');
      toast({
        title: "Redirecionando para WhatsApp",
        description: "Finalize seu pedido pelo WhatsApp!",
      });
    }
  };

  const getTotalPrice = () => {
    return state.items.reduce((total, item) => {
      const priceString = item.price.toString();
      const numericPrice = parseFloat(
        priceString
          .replace('R$', '')
          .replace(/\s/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
      );
      
      const validPrice = isNaN(numericPrice) ? 0 : numericPrice;
      return total + (validPrice * item.quantity);
    }, 0);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getVariationsForItem = (item: any) => {
    if (!item.productId) return [];
    
    const product = products.find(p => p.id === item.productId);
    return product?.variations || [];
  };

  const handleVariationChange = (itemId: string, variationId: string, productId: string) => {
    const variations = getVariationsForItem({ productId });
    const newVariation = variations.find(v => v.id === variationId);
    
    if (newVariation) {
      const newPrice = formatPrice(newVariation.price);
      const newId = `${productId}-${variationId}`;
      const existingItem = state.items.find(item => item.id === newId && item.id !== itemId);
      
      updateVariation(itemId, newVariation, newPrice, productId);
      
      if (existingItem) {
        toast({
          title: "Itens mesclados",
          description: `Produtos iguais foram combinados em um único item`,
        });
      } else {
        toast({
          title: "Variação atualizada",
          description: `Produto alterado para ${newVariation.literage}`,
        });
      }
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          className="relative bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white border-0"
        >
          <ShoppingCart className="h-4 w-4" />
          {state.items.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-green-500 hover:bg-green-500 text-white">
              {state.items.reduce((sum, item) => sum + item.quantity, 0)}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Carrinho de Compras</SheetTitle>
          <SheetDescription>
            {state.items.length === 0 
              ? "Seu carrinho está vazio" 
              : `${state.items.length} produto(s) no carrinho`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 space-y-4">
          {state.items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Adicione produtos ao seu carrinho</p>
            </div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto space-y-4">
                {state.items.map((item) => {
                  const availableVariations = getVariationsForItem(item);
                  const hasVariations = availableVariations.length > 1;
                  
                  return (
                    <Card key={item.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{item.name.split(' - ')[0]}</h4>
                            <p className="text-xs text-muted-foreground">{item.category}</p>
                            <p className="font-bold text-primary">{item.price}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.id)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Seleção de variação - apenas se houver variações disponíveis */}
                        {hasVariations && item.variation && item.productId && (
                          <div className="space-y-2">
                            <label className="text-xs font-medium">Alterar litragem:</label>
                            <Select 
                              value={item.variation.id} 
                              onValueChange={(value) => handleVariationChange(item.id, value, item.productId!)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableVariations.map((variation) => (
                                  <SelectItem key={variation.id} value={variation.id}>
                                    {variation.literage} - {formatPrice(variation.price)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="h-8 w-8"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="h-8 w-8"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="border-t pt-4 mt-6 sticky bottom-0 bg-background">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-semibold">Total:</span>
                  <span className="font-bold text-lg text-primary">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>

                <div className="space-y-2">
                  <Button 
                    onClick={handleWhatsAppOrder}
                    className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center space-x-2"
                    disabled={state.items.length === 0}
                  >
                    <WhatsAppIcon className="w-5 h-5" />
                    <span>Finalizar pelo WhatsApp</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={clearCart}
                    className="w-full"
                    disabled={state.items.length === 0}
                  >
                    Limpar Carrinho
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Cart;
