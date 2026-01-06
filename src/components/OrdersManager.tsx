import { useState } from 'react';
import { ClipboardList, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAdminOrders, OrderStatus } from '@/hooks/useAdminOrders';
import { toast } from 'sonner';

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  confirmed: 'bg-green-500/20 text-green-600 border-green-500/30',
  delivered: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-red-500/20 text-red-600 border-red-500/30',
};

const OrdersManager = () => {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const {
    orders,
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    totalCount,
    statusFilter,
    setStatusFilter,
    updateOrderStatus,
  } = useAdminOrders();

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const success = await updateOrderStatus(orderId, newStatus);
    if (success) {
      toast.success(`Status atualizado para "${statusLabels[newStatus]}"`);
    } else {
      toast.error('Erro ao atualizar status');
    }
  };

  const parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return price;
    // Remove "R$", espaços, pontos de milhar e troca vírgula por ponto
    const cleaned = price.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const formatPrice = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Gerenciar Pedidos</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {totalCount} pedido{totalCount !== 1 ? 's' : ''} no total
              </p>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('pending')}
            >
              Pendentes
            </Button>
            <Button
              variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('confirmed')}
            >
              Confirmados
            </Button>
            <Button
              variant={statusFilter === 'delivered' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('delivered')}
            >
              Entregues
            </Button>
            <Button
              variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('cancelled')}
            >
              Cancelados
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <p className="text-muted-foreground">
              {statusFilter === 'all'
                ? 'Nenhum pedido encontrado'
                : `Nenhum pedido ${statusLabels[statusFilter]?.toLowerCase()}`}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const isExpanded = expandedOrderId === order.id;
                    const items = Array.isArray(order.items) ? order.items : [];
                    
                    return (
                      <Collapsible
                        key={order.id}
                        open={isExpanded}
                        onOpenChange={() => 
                          setExpandedOrderId(isExpanded ? null : order.id)
                        }
                        asChild
                      >
                        <>
                          <TableRow 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          >
                            <TableCell className="font-mono text-xs">
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                                #{order.id.slice(0, 8)}
                              </div>
                            </TableCell>
                            <TableCell>
                              {order.customer_name || 'Não informado'}
                            </TableCell>
                            <TableCell>{order.customer_phone}</TableCell>
                            <TableCell className="text-sm">
                              {formatDate(order.created_at)}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {formatPrice(order.total_amount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusColors[order.status || 'pending']}
                              >
                                {statusLabels[order.status || 'pending']}
                              </Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={order.status || 'pending'}
                                onValueChange={(value) =>
                                  handleStatusChange(order.id, value as OrderStatus)
                                }
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pendente</SelectItem>
                                  <SelectItem value="confirmed">Confirmado</SelectItem>
                                  <SelectItem value="delivered">Entregue</SelectItem>
                                  <SelectItem value="cancelled">Cancelado</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                          
                          {isExpanded && (
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={7} className="p-0">
                                <div className="p-4 space-y-3">
                                  <h4 className="font-semibold text-sm">Itens do Pedido</h4>
                                  <div className="space-y-2">
                                    {items.length > 0 ? (
                                      items.map((item: any, index: number) => (
                                        <div 
                                          key={index}
                                          className="flex items-center justify-between p-3 bg-background rounded-lg border"
                                        >
                                          <div className="flex items-center gap-3">
                                            {item.image_url && (
                                              <img 
                                                src={item.image_url} 
                                                alt={item.name}
                                                className="w-12 h-12 object-cover rounded"
                                              />
                                            )}
                                            <div>
                                              <p className="font-medium">{item.name}</p>
                                              {item.variation && (
                                                <p className="text-xs text-muted-foreground">
                                                  {item.variation}
                                                </p>
                                              )}
                                              {item.fragrance && (
                                                <p className="text-xs text-muted-foreground">
                                                  Fragrância: {item.fragrance}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-semibold">
                                              {formatPrice(parsePrice(item.price) * item.quantity)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {item.quantity}x {formatPrice(parsePrice(item.price))}
                                            </p>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        Nenhum item encontrado
                                      </p>
                                    )}
                                  </div>
                                  {order.notes && (
                                    <div className="pt-2 border-t">
                                      <p className="text-sm">
                                        <span className="font-medium">Observações:</span>{' '}
                                        {order.notes}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Próxima
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default OrdersManager;
