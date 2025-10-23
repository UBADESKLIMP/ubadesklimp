
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
import OrderForm from './OrderForm';
import { ProductVariation, ProductFragrance } from '@/types/product';
import { useProducts } from '@/hooks/useProducts';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';

const Cart = () => {
  const { state, updateQuantity, updateVariation, updateFragrance, removeFromCart, clearCart, getWhatsAppLink } = useCart();
  const { products } = useProducts();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOrderSubmit = async (orderData: { name: string; notes?: string }) => {
    setIsSubmitting(true);
    
    try {
      // Preparar dados do pedido
      const orderPayload = {
        user_id: user?.id || null,
        customer_name: orderData.name,
        customer_phone: null,
        customer_email: user?.email || null,
        items: JSON.parse(JSON.stringify(state.items)) as any,
        total_amount: getTotalPrice(),
        notes: orderData.notes || null,
        whatsapp_sent_at: new Date().toISOString()
      };

      // Salvar pedido no banco
      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar pedido:', error);
        toast({
          title: "Erro ao salvar pedido",
          description: "Não foi possível salvar o pedido, mas você pode continuar pelo WhatsApp.",
          variant: "destructive"
        });
      }

      // Enviar para WhatsApp
      const whatsappMessage = generateWhatsAppMessage(orderData);
      const encodedMessage = encodeURIComponent(whatsappMessage);
      const whatsappLink = `https://wa.me/551238332434?text=${encodedMessage}`;
      
      window.open(whatsappLink, '_blank');
      
      // Limpar carrinho após envio
      clearCart();
      setIsOrderFormOpen(false);
      
      toast({
        title: "Pedido enviado!",
        description: order 
          ? "Pedido salvo e enviado para WhatsApp com sucesso!" 
          : "Pedido enviado para WhatsApp!",
      });
      
    } catch (error) {
      console.error('Erro no processo de pedido:', error);
      toast({
        title: "Erro no pedido",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateWhatsAppMessage = (orderData: { name: string; notes?: string }) => {
    let message = '🛒 *Pedido Ubadesklimp*\n\n';
    message += `👤 *Cliente:* ${orderData.name}\n`;
    message += '\n*Produtos:*\n';
    
    state.items.forEach(item => {
      message += `• ${item.name}\n`;
      message += `  Categoria: ${item.category}\n`;
      message += `  Preço: ${item.price}\n`;
      message += `  Quantidade: ${item.quantity}\n`;
      if (item.fragrance) {
        message += `  Fragrância: ${item.fragrance.name}\n`;
      }
      message += '\n';
    });
    
    message += `💰 *Total:* ${formatPrice(getTotalPrice())}\n\n`;
    
    if (orderData.notes) {
      message += `📝 *Observações:* ${orderData.notes}\n\n`;
    }
    
    message += `🚀 Gostaria de finalizar este pedido!`;
    
    return message;
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

  const getFragrancesForItem = (item: any) => {
    if (!item.productId) {
      // Tentar encontrar productId pelo nome do produto
      const productName = item.name.split(' - ')[0];
      const product = products.find(p => p.name === productName);
      return product?.fragrances || [];
    }
    
    const product = products.find(p => p.id === item.productId);
    return product?.fragrances || [];
  };

  const getVariationsForItem = (item: any) => {
    if (!item.productId) {
      // Tentar encontrar productId pelo nome do produto
      const productName = item.name.split(' - ')[0];
      const product = products.find(p => p.name === productName);
      const allVariations = product?.variations || [];
      
      // Se tem fragrância selecionada, filtrar variações por literage disponível
      if (item.fragrance && item.fragrance.available_literages) {
        return allVariations.filter(variation => 
          item.fragrance.available_literages.includes(variation.literage)
        );
      }
      
      return allVariations;
    }
    
    const product = products.find(p => p.id === item.productId);
    const allVariations = product?.variations || [];
    
    // Se tem fragrância selecionada, filtrar variações por literage disponível
    if (item.fragrance && item.fragrance.available_literages) {
      return allVariations.filter(variation => 
        item.fragrance.available_literages.includes(variation.literage)
      );
    }
    
    return allVariations;
  };

  const handleFragranceChange = (itemId: string, fragranceId: string, productId: string) => {
    // Se não tem productId, tentar encontrar pelo nome
    let finalProductId = productId;
    if (!finalProductId) {
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        const productName = item.name.split(' - ')[0];
        const product = products.find(p => p.name === productName);
        finalProductId = product?.id || '';
      }
    }
    
    const fragrances = getFragrancesForItem({ productId: finalProductId });
    const newFragrance = fragrances.find(f => f.id === fragranceId);
    
    if (newFragrance && finalProductId) {
      // Atualiza a fragrância do item
      updateFragrance(itemId, newFragrance, finalProductId);

      // Garantir que a litragem selecionada continue válida para a nova fragrância
      const allowedVariations = getVariationsForItem({ productId: finalProductId, fragrance: newFragrance });
      const currentItem = state.items.find(i => i.id === itemId);
      const currentLiterage = currentItem?.variation?.literage;
      const stillAllowed = allowedVariations.some(v => v.literage === currentLiterage);

      if (!stillAllowed && allowedVariations.length > 0) {
        const v = allowedVariations[0];
        handleVariationChange(itemId, v.id, finalProductId);
      }

      toast({
        title: "Fragrância atualizada",
        description: `Fragrância alterada para ${newFragrance.name}`,
      });
    }
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
                  const availableFragrances = getFragrancesForItem(item);
                  const availableVariations = getVariationsForItem(item);
                  const hasFragrances = availableFragrances.length > 0;
                  const hasVariations = availableVariations.length > 1;
                  
                  return (
                    <Card key={item.id} className="p-4">
                      <div className="flex gap-3">
                        {/* Imagem do produto */}
                        <div className="flex-shrink-0">
                          <img 
                            src={item.variation?.image_url || item.fragrance?.image_url || item.image_url || '/placeholder.svg'} 
                            alt={item.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border"
                          />
                        </div>

                        {/* Conteúdo do item */}
                        <div className="flex-1 space-y-3">
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

                          {/* Seleção de fragrância - se houver fragrâncias disponíveis */}
                          {hasFragrances && (
                          <div className="space-y-2">
                            <label className="text-xs font-medium">Fragrância:</label>
                            <Select 
                              value={item.fragrance?.id || ""} 
                              onValueChange={(value) => {
                                const finalProductId = item.productId || products.find(p => p.name === item.name.split(' - ')[0])?.id;
                                if (finalProductId) {
                                  handleFragranceChange(item.id, value, finalProductId);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecione a fragrância" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableFragrances.map((fragrance) => (
                                  <SelectItem key={fragrance.id} value={fragrance.id}>
                                    {fragrance.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          )}

                          {/* Seleção de variação - apenas se houver variações disponíveis */}
                          {hasVariations && item.variation && item.productId && (
                          <div className="space-y-2">
                            <label className="text-xs font-medium">Litragem:</label>
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
                    onClick={() => setIsOrderFormOpen(true)}
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

        <OrderForm
          isOpen={isOrderFormOpen}
          onClose={() => setIsOrderFormOpen(false)}
          onSubmit={handleOrderSubmit}
          loading={isSubmitting}
        />
      </SheetContent>
    </Sheet>
  );
};

export default Cart;
