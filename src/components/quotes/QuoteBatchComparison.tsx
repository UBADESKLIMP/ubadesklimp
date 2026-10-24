import { useMemo, useState } from 'react';
import { ArrowLeft, MessageCircle, FileDown, Pencil, X, RotateCcw, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { unidadeSugerida } from '@/lib/unidadeCompra';
import ConfirmarQuantidadesDialog, {
  type ItemDoPedido,
  type LinhaConfirmada,
} from './ConfirmarQuantidadesDialog';

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
    removeItem,
    updateItemQuantity,
    updateItemPedido,
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
  const [confirmandoSupplierId, setConfirmandoSupplierId] = useState<string | null>(null);
  const [showAllPrices, setShowAllPrices] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  // Guarda o itemId junto: a tela de confirmar quantidades precisa dele pra
  // gravar a quantidade de cada item antes de disparar o pedido.
  const orderDetailsBySupplier = new Map<string, ItemDoPedido[]>();
  for (const item of sortedItems) {
    const winnerId = winners.get(item.id);
    if (!winnerId) continue;
    const price = getPrice(item.id, winnerId);
    if (price === null) continue;
    const product = productById.get(item.product_id);
    const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
    const list = orderDetailsBySupplier.get(winnerId) ?? [];
    list.push({
      itemId: item.id,
      name: displayName,
      unitPrice: price,
      quantity: item.quantity,
      unidadeCompra: item.unidade_compra,
      observacao: getNote(item.id, winnerId),
    });
    orderDetailsBySupplier.set(winnerId, list);
  }

  // Pro WhatsApp e pro PDF, que não precisam do id. Quantidade já confirmada
  // na hora de gerar o pedido; o fallback de 1 só cobre lote antigo.
  const orderItemsOf = (detalhes: ItemDoPedido[]): PurchaseOrderItem[] =>
    detalhes.map((d) => ({
      name: d.name,
      quantity: d.quantity ?? 1,
      unitPrice: d.unitPrice,
      unidadeCompra: unidadeSugerida(d.unidadeCompra),
    }));

  const itemsWithoutWinner = sortedItems.filter((item) => {
    const winnerId = winners.get(item.id);
    return !winnerId || getPrice(item.id, winnerId) === null;
  });

  // Um cartão por fornecedor que ganhou pelo menos um item.
  const supplierCards = Array.from(orderDetailsBySupplier.entries()).map(([supplierId, details]) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    const orderItems = orderItemsOf(details);
    const rows = details.map((d) => {
      const item = sortedItems.find((i) => i.id === d.itemId)!;
      return { item, name: d.name, price: d.unitPrice, source: getWinnerSource(d.itemId) ?? 'auto' };
    });
    return {
      supplierId,
      supplier,
      rows,
      orderItems,
      total: orderItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      alreadySent: Boolean(supplier?.order_generated_at) || isReadOnly,
    };
  });

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

  // Grava as quantidades confirmadas e só então dispara o pedido.
  const handleConfirmarQuantidades = async (
    supplierId: string,
    linhas: Record<string, LinhaConfirmada>
  ) => {
    setGeneratingSupplierId(supplierId);
    try {
      for (const [itemId, linha] of Object.entries(linhas)) {
        await updateItemPedido(itemId, linha.quantidade, linha.unidadeCompra);
      }
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
          <h2 className="text-2xl font-heading text-white">Comprar pelo menor preço</h2>
          <p className="text-sm text-blue-300/60 mt-1">
            {items.length} item(ns) · {suppliers.length} fornecedor(es)
            {isReadOnly && ' · somente leitura'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {itemsWithoutWinner.length > 0 && (
          <div className="border rounded-lg p-4 space-y-1 bg-muted/30">
            <p className="font-medium text-sm">Ainda sem preço ({itemsWithoutWinner.length})</p>
            <p className="text-xs text-muted-foreground">
              Nenhum fornecedor mandou preço para estes itens. Eles continuam pendentes em Faltantes.
            </p>
            <ul className="text-sm list-disc pl-5">
              {itemsWithoutWinner.map((item) => (
                <li key={item.id}>
                  {buildMissingItemDisplayName(productById.get(item.product_id), item.fragrance_id, item.variation_id)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {supplierCards.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ainda não há preços para comparar. Volte e anote os preços de cada fornecedor.
          </p>
        )}

        {supplierCards.map(({ supplierId, supplier, rows, orderItems, total, alreadySent }) => (
          <div key={supplierId} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="font-semibold">
                  {supplier ? `${supplier.company_name} (${supplier.contact_name})` : 'Fornecedor'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rows.length} item(ns)
                  {supplier?.order_generated_at &&
                    ` · Pedido montado em ${new Date(supplier.order_generated_at).toLocaleDateString('pt-BR')}`}
                </p>
              </div>
              <p className="text-lg font-semibold">{formatPrice(total)}</p>
            </div>

            <div className="divide-y">
              {rows.map(({ item, name, price, source }) => {
                const options = suppliers.filter(
                  (s) => getPrice(item.id, s.id) !== null && !getExcluded(item.id, s.id)
                );
                return (
                  <div key={item.id} className="py-2 flex items-center gap-3 flex-wrap">
                    <Input
                      key={item.id}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      disabled={isReadOnly}
                      defaultValue={item.quantity ?? ''}
                      placeholder="Qtd"
                      className="h-9 w-20"
                      onBlur={(e) => handleQuantityBlur(item.id, e.target.value)}
                    />
                    <span className="text-sm flex-1 min-w-40">{name}</span>
                    {editingCell?.itemId === item.id && editingCell?.supplierId === supplierId ? (
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        autoFocus
                        className="h-9 w-28"
                        value={editingPriceValue}
                        onChange={(e) => setEditingPriceValue(e.target.value)}
                        onBlur={saveEditingPrice}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={isReadOnly}
                        title="Clique para corrigir o preço"
                        onClick={() => startEditingPrice(item.id, supplierId, price)}
                        className="text-sm font-medium inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted/60 disabled:hover:bg-transparent"
                      >
                        {formatPrice(price)}
                        {!isReadOnly && <Pencil className="h-3 w-3 text-muted-foreground" />}
                      </button>
                    )}
                    {getCorrected(item.id, supplierId) && (
                      <Badge variant="secondary" className="text-[10px]">Preço corrigido</Badge>
                    )}
                    {source !== 'auto' && <Badge variant="secondary" className="text-[10px]">Escolhido por você</Badge>}
                    {!isReadOnly && options.length > 1 && (
                      <Select value={supplierId} onValueChange={(value) => setWinner(item.id, value)}>
                        <SelectTrigger className="h-9 w-44 text-xs">
                          <SelectValue placeholder="Trocar fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.company_name} · {formatPrice(getPrice(item.id, s.id) ?? 0)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                        title="Tirar este produto da cotação"
                        aria-label="Tirar este produto da cotação"
                        onClick={() => {
                          if (window.confirm(`Tirar "${name}" desta cotação? Ele continua pendente em Faltantes.`)) {
                            removeItem(item.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {batchStatus !== 'cancelado' && (
              <div className="flex items-center gap-2 flex-wrap">
                {!alreadySent && (
                  <Button
                    disabled={generatingSupplierId === supplierId}
                    onClick={() => setConfirmandoSupplierId(supplierId)}
                  >
                    Montar pedido deste fornecedor
                  </Button>
                )}
                {alreadySent && (
                  <>
                    {!isReadOnly && (
                      <Button
                        variant="outline"
                        disabled={generatingSupplierId === supplierId}
                        onClick={() => setConfirmandoSupplierId(supplierId)}
                      >
                        Corrigir quantidades e reenviar
                      </Button>
                    )}
                    <Button asChild variant="outline">
                      <a
                        href={buildWhatsAppLink(supplier?.phone ?? '', buildPurchaseOrderMessage(orderItems))}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Enviar pelo WhatsApp
                      </a>
                    </Button>
                    <Button
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
            )}

            <ConfirmarQuantidadesDialog
              open={confirmandoSupplierId === supplierId}
              onOpenChange={(aberto) => setConfirmandoSupplierId(aberto ? supplierId : null)}
              fornecedor={supplier?.company_name ?? 'Este fornecedor'}
              itens={orderDetailsBySupplier.get(supplierId) ?? []}
              jaGerado={alreadySent}
              onConfirmar={(quantidades) => handleConfirmarQuantidades(supplierId, quantidades)}
            />
          </div>
        ))}

        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={() => setShowAllPrices((prev) => !prev)}>
            <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showAllPrices ? 'rotate-180' : ''}`} />
            {showAllPrices ? 'Esconder todos os preços' : 'Ver todos os preços lado a lado'}
          </Button>
          {showAllPrices && (
            <>
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
            </>
          )}
        </div>

        {!isReadOnly && (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((prev) => !prev)}>
              <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              Avançado
            </Button>
            {showAdvanced && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Pedir ajuste ao assistente</p>
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
          </div>
        )}

        {batchStatus === 'aberto' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isArchiving} className="w-full">
                Encerrar esta cotação
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Encerrar esta cotação?</AlertDialogTitle>
                <AlertDialogDescription>
                  Só tira esta cotação da lista de abertas. Itens que ficaram sem preço continuam pendentes em Faltantes
                  normalmente. Não dá para reabrir depois.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>Encerrar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteBatchComparison;
