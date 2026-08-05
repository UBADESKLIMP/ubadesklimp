import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingBag, Calendar, Phone, ArrowLeft, Package, Clock, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type OrderRow, type OrderItem, parseOrderItems } from '@/types/order';

const ORDERS_PER_PAGE = 5;

type Order = Omit<OrderRow, 'items'> & { items: OrderItem[] };

const OrderHistory = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.ceil(totalCount / ORDERS_PER_PAGE);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      setLoading(true);
      try {
        // Primeiro, buscar contagem total
        const { count, error: countError } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) throw countError;
        setTotalCount(count || 0);

        // Buscar pedidos da página atual
        const from = (currentPage - 1) * ORDERS_PER_PAGE;
        const to = from + ORDERS_PER_PAGE - 1;

        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        setOrders((data || []).map((order) => ({
          ...order,
          items: parseOrderItems(order.items, order.id),
        })));
      } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user, currentPage]);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pendente', variant: 'secondary' as const, icon: Clock },
      confirmed: { label: 'Confirmado', variant: 'default' as const, icon: CheckCircle },
      delivered: { label: 'Entregue', variant: 'outline' as const, icon: Package },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const parsePrice = (price: any): number => {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const numericPrice = parseFloat(
        price
          .replace('R$', '')
          .replace(/\s/g, '')
          .replace(/\./g, '')
          .replace(',', '.')
      );
      return isNaN(numericPrice) ? 0 : numericPrice;
    }
    return 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleWhatsAppContact = (orderId: string) => {
    const message = encodeURIComponent(`Olá! Gostaria de saber sobre o status do meu pedido #${orderId.slice(0, 8)}.`);
    window.open(`https://wa.me/551238332434?text=${message}`, '_blank');
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="animate-pulse text-foreground">Carregando histórico...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle pt-20 pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao início
          </Link>
          <h1 className="text-3xl font-heading text-gradient mb-2">Histórico de Pedidos</h1>
          <p className="text-muted-foreground">
            {totalCount > 0 
              ? `Você tem ${totalCount} pedido${totalCount > 1 ? 's' : ''} registrado${totalCount > 1 ? 's' : ''}.`
              : 'Acompanhe todos os seus pedidos realizados.'
            }
          </p>
        </div>

        {totalCount === 0 ? (
          <Card className="shadow-elegant">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum pedido encontrado</h3>
              <p className="text-muted-foreground text-center mb-6">
                Você ainda não fez nenhum pedido. Que tal dar uma olhada em nossos produtos?
              </p>
              <Button asChild className="bg-gradient-primary hover:shadow-glow">
                <Link to="/#products">Ver Produtos</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <Card key={order.id} className="shadow-elegant">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        Pedido #{order.id.slice(0, 8)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      {getStatusBadge(order.status)}
                      <div className="text-2xl font-bold text-primary mt-1">
                        {formatCurrency(order.total_amount)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Order Items */}
                    <div>
                      <h4 className="font-semibold mb-3">Produtos:</h4>
                      <ScrollArea className="max-h-48">
                        <div className="space-y-2">
                          {order.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                              <div className="flex-1">
                                <div className="font-medium">{item.name}</div>
                                {item.fragrance && (
                                  <div className="text-sm text-muted-foreground">
                                    Fragrância: {item.fragrance.name}
                                  </div>
                                )}
                                {item.variation && (
                                  <div className="text-sm text-muted-foreground">
                                    Litragem: {item.variation.literage}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-medium">
                                  {item.quantity}x {formatCurrency(parsePrice(item.price))}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  = {formatCurrency(item.quantity * parsePrice(item.price))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {order.notes && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-semibold mb-2">Observações:</h4>
                          <p className="text-muted-foreground bg-muted/30 p-3 rounded-lg">
                            {order.notes}
                          </p>
                        </div>
                      </>
                    )}

                    <Separator />

                    {/* Actions */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        {order.whatsapp_sent_at && (
                          <span>Enviado via WhatsApp em {format(new Date(order.whatsapp_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppContact(order.id)}
                        className="flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4" />
                        Entrar em Contato
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === currentPage ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page)}
                      className="w-9 h-9 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Page info */}
            {totalPages > 1 && (
              <p className="text-center text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * ORDERS_PER_PAGE) + 1} - {Math.min(currentPage * ORDERS_PER_PAGE, totalCount)} de {totalCount} pedidos
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;