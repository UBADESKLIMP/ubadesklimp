import { useMemo, useState } from 'react';
import { ArrowLeft, MessageCircle, FileDown, Pencil, X, RotateCcw } from 'lucide-react';
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
import { buildMissingItemDisplayName, compareMissingItems } from '@/lib/missingProductDisplay';
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
  const {
    loading,
    batchStatus,
    items,
    suppliers,
    getPrice,
    getNote,
    getExcluded,
    getCorrected,
    winners,
    getWinnerSource,
    setWinner,
    applyCommand,
    setPriceExcluded,
    correctPrice,
    updateItemQuantity,
    generateSupplierOrder,
    archiveBatch,
  } = useQuoteBatchComparison(batchId);
  const [command, setCommand] = useState('');
  const [isApplyingCommand, setIsApplyingCommand] = useState(false);
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const [generatingSupplierId, setGeneratingSupplierId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ itemId: string; supplierId: string } | null>(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const productById = new Map(products.map((p) => [p.id, p]));
  const isReadOnly = batchStatus !== 'aberto';
  // Agrupa variações do mesmo produto lado a lado (tabela, subtotais e pedido
  // final), em vez da ordem de inserção no banco.
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        compareMissingItems(
          { product: productById.get(a.product_id), fragranceId: a.fragrance_id, variationId: a.variation_id },
          { product: productById.get(b.product_id), fragranceId: b.fragrance_id, variationId: b.variation_id }
        )
      ),
    [items, products]
  );

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
    subtotalBySupplier.set(winnerId, (subtotalBySupplier.get(winnerId) ?? 0) + price * (item.quantity ?? 1));
  }

  const orderItemsBySupplier = new Map<string, PurchaseOrderItem[]>();
  for (const item of sortedItems) {
    const winnerId = winners.get(item.id);
    if (!winnerId) continue;
    const price = getPrice(item.id, winnerId);
    if (price === null) continue;
    const product = productById.get(item.product_id);
    const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
    const list = orderItemsBySupplier.get(winnerId) ?? [];
    // Pedido final precisa de uma quantidade real pro fornecedor — cotação
    // pode ficar sem quantidade definida, mas o pedido assume 1 nesse caso.
    list.push({ name: displayName, quantity: item.quantity ?? 1, unitPrice: price });
    orderItemsBySupplier.set(winnerId, list);
  }

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveBatch();
    } finally {
      setIsArchiving(false);
    }
  };

  const handleGenerateSupplierOrder = async (supplierId: string) => {
    setGeneratingSupplierId(supplierId);
    try {
      await generateSupplierOrder(supplierId);
    } finally {
      setGeneratingSupplierId(null);
    }
  };

  const handleQuantityBlur = (itemId: string, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      updateItemQuantity(itemId, null);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    updateItemQuantity(itemId, !Number.isNaN(parsed) && parsed > 0 ? parsed : null);
  };

  const startEditingPrice = (itemId: string, supplierId: string, currentPrice: number) => {
    setEditingCell({ itemId, supplierId });
    setEditingPriceValue(String(currentPrice));
  };

  const saveEditingPrice = async () => {
    const cell = editingCell;
    setEditingCell(null);
    if (!cell) return;
    const parsed = parseFloat(editingPriceValue.replace(',', '.'));
    if (Number.isNaN(parsed)) return;
    await correctPrice(cell.itemId, cell.supplierId, parsed);
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
                    <span className="block font-normal text-muted-foreground">({supplier.contact_name})</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map((item) => {
                const product = productById.get(item.product_id);
                const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                const winnerId = winners.get(item.id);
                const winnerSource = getWinnerSource(item.id);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Input
                          key={item.id}
                          type="number"
                          min="1"
                          disabled={isReadOnly}
                          defaultValue={item.quantity ?? ''}
                          placeholder="Qtd"
                          className="h-7 w-16"
                          onBlur={(e) => handleQuantityBlur(item.id, e.target.value)}
                        />
                        <span>{displayName}</span>
                      </div>
                    </TableCell>
                    {suppliers.map((supplier) => {
                      const price = getPrice(item.id, supplier.id);
                      const note = getNote(item.id, supplier.id);
                      const excluded = getExcluded(item.id, supplier.id);
                      const corrected = getCorrected(item.id, supplier.id);
                      const isWinner = winnerId === supplier.id;
                      const isManualWinner = isWinner && winnerSource !== 'auto';
                      const isEditingCell = editingCell?.itemId === item.id && editingCell?.supplierId === supplier.id;
                      return (
                        <TableCell key={supplier.id}>
                          {price === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : isEditingCell ? (
                            <Input
                              type="number"
                              step="0.01"
                              autoFocus
                              className="h-7 w-24"
                              value={editingPriceValue}
                              onChange={(e) => setEditingPriceValue(e.target.value)}
                              onBlur={saveEditingPrice}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') setEditingCell(null);
                              }}
                            />
                          ) : (
                            <div className="group flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isReadOnly || excluded}
                                onClick={() => setWinner(item.id, supplier.id)}
                                className={`text-sm px-2 py-1 rounded ${
                                  excluded
                                    ? 'text-muted-foreground line-through'
                                    : isManualWinner
                                      ? 'bg-amber-600 text-white font-semibold'
                                      : isWinner
                                        ? 'bg-emerald-600 text-white font-semibold'
                                        : 'hover:bg-muted/50'
                                } ${isReadOnly || excluded ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                {formatPrice(price)}
                                {isWinner && !excluded && (
                                  <Badge variant="secondary" className="ml-2 text-[10px]">
                                    {isManualWinner ? 'Manual' : 'Mais barato'}
                                  </Badge>
                                )}
                                {corrected && (
                                  <Badge
                                    variant="secondary"
                                    className="ml-2 text-[10px] bg-blue-600 text-white hover:bg-blue-600"
                                  >
                                    Editado
                                  </Badge>
                                )}
                              </button>
                              {!isReadOnly &&
                                (excluded ? (
                                  <button
                                    type="button"
                                    aria-label="Restaurar preço"
                                    title="Restaurar preço"
                                    onClick={() => setPriceExcluded(item.id, supplier.id, false)}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      aria-label="Editar preço"
                                      title="Editar preço"
                                      onClick={() => startEditingPrice(item.id, supplier.id, price)}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Excluir preço da comparação"
                                      title="Excluir preço da comparação"
                                      onClick={() => setPriceExcluded(item.id, supplier.id, true)}
                                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                ))}
                            </div>
                          )}
                          {note && <p className="text-xs text-muted-foreground px-2">{note}</p>}
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
              {supplier.company_name} ({supplier.contact_name}): {formatPrice(subtotalBySupplier.get(supplier.id) ?? 0)}
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

        {batchStatus !== 'cancelado' && orderItemsBySupplier.size > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Pedidos de compra</p>
            {Array.from(orderItemsBySupplier.entries()).map(([supplierId, orderItems]) => {
              const supplier = suppliers.find((s) => s.id === supplierId);
              const total = orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
              // Lote arquivado (isReadOnly) sempre conta como "já enviado" mesmo
              // sem order_generated_at — lotes concluídos antes desta coluna
              // existir (sem backfill) não podem voltar a mostrar "Gerar
              // pedido", que exigiria um lote aberto pra confirmar.
              const alreadySent = Boolean(supplier?.order_generated_at) || isReadOnly;
              return (
                <div key={supplierId} className="border rounded-lg p-4 space-y-2">
                  <p className="font-medium text-sm">
                    {supplier ? `${supplier.company_name} (${supplier.contact_name})` : 'Fornecedor'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {orderItems.length} item(ns) · Total: {formatPrice(total)}
                    {supplier?.order_generated_at &&
                      ` · Pedido gerado em ${new Date(supplier.order_generated_at).toLocaleDateString('pt-BR')}`}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!alreadySent && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" disabled={generatingSupplierId === supplierId}>
                            Gerar pedido
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Gerar pedido pra {supplier?.company_name ?? 'este fornecedor'}?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Marca os {orderItems.length} item(ns) dele como pedido enviado em Faltantes. Os
                              outros itens do lote continuam como estão.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleGenerateSupplierOrder(supplierId)}>
                              Gerar pedido
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    {alreadySent && (
                      <>
                        {!isReadOnly && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={generatingSupplierId === supplierId}
                            onClick={() => handleGenerateSupplierOrder(supplierId)}
                          >
                            Reenviar / atualizar pedido
                          </Button>
                        )}
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
                          onClick={() =>
                            downloadPurchaseOrderPdf(
                              supplier ? `${supplier.company_name} (${supplier.contact_name})` : 'fornecedor',
                              orderItems
                            )
                          }
                        >
                          <FileDown className="h-4 w-4 mr-2" />
                          Baixar PDF
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {batchStatus === 'aberto' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isArchiving} className="w-full">
                Arquivar lote
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Arquivar este lote?</AlertDialogTitle>
                <AlertDialogDescription>
                  Só organiza a lista de lotes — itens ainda sem vencedor continuam pendentes em Faltantes
                  normalmente, sem mudança. Não tem como desarquivar.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>Arquivar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteBatchComparison;
