import { useState } from 'react';
import { ArrowLeft, MessageCircle, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useQuoteBatchComparison } from '@/hooks/useQuoteBatchComparison';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { buildPurchaseOrderMessage, downloadPurchaseOrderPdf, PurchaseOrderItem } from '@/lib/purchaseOrder';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';

interface QuoteBatchComparisonProps {
  batchId: string;
  products: ProductWithVariations[];
  onBack: () => void;
}

const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

const QuoteBatchComparison = ({ batchId, products, onBack }: QuoteBatchComparisonProps) => {
  const { loading, batchStatus, items, suppliers, getPrice, winners, setWinner, applyCommand, finalizeBatch } =
    useQuoteBatchComparison(batchId);
  const [command, setCommand] = useState('');
  const [isApplyingCommand, setIsApplyingCommand] = useState(false);
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const productById = new Map(products.map((p) => [p.id, p]));
  const isReadOnly = batchStatus !== 'aberto';

  const handleApplyCommand = async () => {
    const trimmed = command.trim();
    if (!trimmed) return;
    setIsApplyingCommand(true);
    try {
      const { applied, skipped } = await applyCommand(trimmed);
      setCommandLog((prev) => [
        `"${trimmed}" — ${applied} reatribuído(s)${skipped > 0 ? `, ${skipped} ignorado(s)` : ''}.`,
        ...prev,
      ]);
      setCommand('');
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsApplyingCommand(false);
    }
  };

  const subtotalBySupplier = new Map<string, number>();
  for (const item of items) {
    const winnerId = winners.get(item.id);
    if (!winnerId) continue;
    const price = getPrice(item.id, winnerId);
    if (price === null) continue;
    subtotalBySupplier.set(winnerId, (subtotalBySupplier.get(winnerId) ?? 0) + price * item.quantity);
  }

  const allItemsHaveWinner =
    items.length > 0 &&
    items.every((item) => {
      const winnerId = winners.get(item.id);
      return !!winnerId && getPrice(item.id, winnerId) !== null;
    });

  const orderItemsBySupplier = new Map<string, PurchaseOrderItem[]>();
  for (const item of items) {
    const winnerId = winners.get(item.id);
    if (!winnerId) continue;
    const price = getPrice(item.id, winnerId);
    if (price === null) continue;
    const product = productById.get(item.product_id);
    const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
    const list = orderItemsBySupplier.get(winnerId) ?? [];
    list.push({ name: displayName, quantity: item.quantity, unitPrice: price });
    orderItemsBySupplier.set(winnerId, list);
  }

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await finalizeBatch();
    } finally {
      setIsFinalizing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <AdminLoadingState rows={4} tone="light" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="w-fit text-blue-300 hover:text-blue-200 hover:bg-blue-500/10">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-heading text-white">Comparação de preços</h2>
          <p className="text-sm text-blue-300/60 mt-1">
            {items.length} item(ns) · {suppliers.length} fornecedor(es)
            {isReadOnly && ' · somente leitura'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                {suppliers.map((supplier) => (
                  <TableHead key={supplier.id} className="min-w-32">
                    {supplier.company_name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const product = productById.get(item.product_id);
                const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                const winnerId = winners.get(item.id);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.quantity}x {displayName}
                    </TableCell>
                    {suppliers.map((supplier) => {
                      const price = getPrice(item.id, supplier.id);
                      const isWinner = winnerId === supplier.id;
                      return (
                        <TableCell key={supplier.id}>
                          {price === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <button
                              type="button"
                              disabled={isReadOnly}
                              onClick={() => setWinner(item.id, supplier.id)}
                              className={`text-sm px-2 py-1 rounded ${
                                isWinner ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted/50'
                              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {formatPrice(price)}
                              {isWinner && (
                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                  Vencedor
                                </Badge>
                              )}
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Subtotal por fornecedor</p>
          {suppliers.map((supplier) => (
            <p key={supplier.id} className="text-sm text-muted-foreground">
              {supplier.company_name}: {formatPrice(subtotalBySupplier.get(supplier.id) ?? 0)}
            </p>
          ))}
        </div>
        {!isReadOnly && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Pedir ajuste à IA</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder='Ex: "tira o Fornecedor X, passa os itens dele pro próximo colocado"'
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyCommand();
                }}
                disabled={isApplyingCommand}
              />
              <Button onClick={handleApplyCommand} disabled={isApplyingCommand || !command.trim()}>
                {isApplyingCommand ? 'Aplicando...' : 'Aplicar'}
              </Button>
            </div>
            {commandLog.length > 0 && (
              <div className="space-y-1">
                {commandLog.map((entry, index) => (
                  <p key={index} className="text-xs text-muted-foreground">
                    {entry}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
        {batchStatus === 'aberto' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!allItemsHaveWinner || isFinalizing} className="w-full">
                Gerar pedidos de compra
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Gerar pedidos de compra?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso fecha este lote de cotação e marca os itens de Faltantes correspondentes como resolvidos. Não
                  tem como desfazer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleFinalize}>Gerar pedidos</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {batchStatus === 'concluido' && orderItemsBySupplier.size > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Pedidos de compra</p>
            {Array.from(orderItemsBySupplier.entries()).map(([supplierId, orderItems]) => {
              const supplier = suppliers.find((s) => s.id === supplierId);
              const total = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
              return (
                <div key={supplierId} className="border rounded-lg p-4 space-y-2">
                  <p className="font-medium text-sm">{supplier?.company_name ?? 'Fornecedor'}</p>
                  <p className="text-xs text-muted-foreground">
                    {orderItems.length} item(ns) · Total: {formatPrice(total)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={buildWhatsAppLink(supplier?.phone ?? '', buildPurchaseOrderMessage(orderItems))}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadPurchaseOrderPdf(supplier?.company_name ?? 'fornecedor', orderItems)}
                    >
                      <FileDown className="h-4 w-4 mr-2" />
                      Baixar PDF
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteBatchComparison;
