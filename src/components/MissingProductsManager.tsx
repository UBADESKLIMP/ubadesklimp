import { useState } from 'react';
import { Plus, X, Check, ChevronsUpDown, ClipboardCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMissingProducts, MissingProductReportItem } from '@/hooks/useMissingProducts';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { ProductWithVariations } from '@/types/product';
import { StaffAccess } from '@/hooks/useStaffAccess';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
import { cn, normalizeText } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useQuoteBatches } from '@/hooks/useQuoteBatches';

interface ReportRow {
  key: string;
  productId: string | null;
  fragranceId: string | null;
  variationId: string | null;
  stockRemaining: string;
}

const emptyRow = (): ReportRow => ({
  key: crypto.randomUUID(),
  productId: null,
  fragranceId: null,
  variationId: null,
  stockRemaining: '',
});

const toNullableInt = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
};

interface ProductPickerProps {
  products: ProductWithVariations[];
  value: string | null;
  onChange: (productId: string) => void;
}

// Combobox pesquisável — padrão shadcn (Popover + Command). Não tem mais
// exclusão de produto já escolhido em outra linha: com fragrância/tamanho,
// o mesmo produto pode legitimamente aparecer duas vezes no lote (ex: "Ypê
// Rosa" e "Ypê Azul"). Duplicata exata do mesmo combo é resolvida pelo
// índice único do banco (vira incremento, não erro — ver useMissingProducts).
const ProductPicker = ({ products, value, onChange }: ProductPickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? selected.name : 'Escolher produto...'}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={(value, search) => (normalizeText(value).includes(normalizeText(search)) ? 1 : 0)}>
          <CommandInput placeholder="Buscar produto..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onChange(product.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === product.id ? 'opacity-100' : 'opacity-0')} />
                  {product.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

interface FragranceVariationFieldsProps {
  product: ProductWithVariations | undefined;
  fragranceId: string | null;
  variationId: string | null;
  onFragranceChange: (fragranceId: string) => void;
  onVariationChange: (variationId: string) => void;
}

// Só renderiza os seletores que fazem sentido pro produto escolhido. Quando
// uma fragrância tem available_literages preenchido, o seletor de Tamanho
// mostra só as variações daquela fragrância; sem fragrância escolhida (ou
// produto sem fragrância), mostra todas as variações do produto.
const FragranceVariationFields = ({
  product,
  fragranceId,
  variationId,
  onFragranceChange,
  onVariationChange,
}: FragranceVariationFieldsProps) => {
  if (!product) return null;

  const fragrances = product.fragrances ?? [];
  const hasFragrances = fragrances.length > 0;

  const allVariations = product.variations ?? [];
  const selectedFragrance = fragrances.find((f) => f.id === fragranceId);
  const filteredVariations = selectedFragrance?.available_literages?.length
    ? allVariations.filter((v) => selectedFragrance.available_literages!.includes(v.literage))
    : allVariations;
  const availableVariations = filteredVariations.length > 0 ? filteredVariations : allVariations;
  const hasVariations = allVariations.length > 0;

  if (!hasFragrances && !hasVariations) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {hasFragrances && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Fragrância</Label>
          <Select value={fragranceId ?? undefined} onValueChange={onFragranceChange}>
            <SelectTrigger>
              <SelectValue placeholder="Escolher..." />
            </SelectTrigger>
            <SelectContent>
              {fragrances.map((fragrance) => (
                <SelectItem key={fragrance.id} value={fragrance.id}>
                  {fragrance.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {hasVariations && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tamanho</Label>
          <Select value={variationId ?? undefined} onValueChange={onVariationChange}>
            <SelectTrigger>
              <SelectValue placeholder="Escolher..." />
            </SelectTrigger>
            <SelectContent>
              {availableVariations.map((variation) => (
                <SelectItem key={variation.id} value={variation.id}>
                  {variation.literage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

interface MissingProductsManagerProps {
  products: ProductWithVariations[];
  staffAccess: StaffAccess;
}

// Uma linha com produto escolhido só está "completa" se as fragrâncias/
// tamanhos obrigatórios (quando o produto tem) também foram escolhidos.
const isRowComplete = (row: ReportRow, productById: Map<string, ProductWithVariations>): boolean => {
  if (!row.productId) return false;
  const product = productById.get(row.productId);
  if (!product) return false;
  const needsFragrance = (product.fragrances?.length ?? 0) > 0;
  const needsVariation = (product.variations?.length ?? 0) > 0;
  if (needsFragrance && !row.fragranceId) return false;
  if (needsVariation && !row.variationId) return false;
  return true;
};

const MissingProductsManager = ({ products, staffAccess }: MissingProductsManagerProps) => {
  const { missingProducts, loading, reportMissingProducts, resolveMissingProduct, cancelMissingProduct, displayNameStatus } =
    useMissingProducts();
  const { openItemIds } = useQuoteBatches();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([emptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const canResolve =
    staffAccess.isAdmin || (staffAccess.permissions.has('faltantes') && staffAccess.permissions.has('fornecedores'));
  const productById = new Map(products.map((p) => [p.id, p]));
  const hasChosenProduct = rows.some((row) => row.productId !== null);
  const hasIncompleteRow = rows.some((row) => row.productId !== null && !isRowComplete(row, productById));

  const updateRow = (key: string, updater: (row: ReportRow) => ReportRow) => {
    setRows((prev) => prev.map((row) => (row.key === key ? updater(row) : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (key: string) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.key !== key)));

  const openReportDialog = () => {
    setRows([emptyRow()]);
    setIsReportOpen(true);
  };

  const handleSubmit = async () => {
    const items: MissingProductReportItem[] = rows
      .filter((row) => row.productId !== null)
      .map((row) => ({
        key: row.key,
        productId: row.productId as string,
        fragranceId: row.fragranceId,
        variationId: row.variationId,
        stockRemaining: toNullableInt(row.stockRemaining),
      }));

    if (items.length === 0) return;

    setIsSubmitting(true);
    try {
      const { succeeded } = await reportMissingProducts(items);
      const stillPending = rows.filter((row) => row.productId !== null && !succeeded.includes(row.key));

      if (stillPending.length === 0) {
        setRows([emptyRow()]);
        setIsReportOpen(false);
      } else {
        setRows(stillPending);
      }
    } catch {
      // erro já mostrado via toast dentro do hook, ou lançado antes do toast
      // (ex: nome de exibição ainda não carregado) — nesse caso não há toast,
      // mas o botão de enviar já fica desabilitado até o nome carregar.
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      await resolveMissingProduct(id);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setResolvingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancelar este item? Ele some da lista de faltantes (não é o mesmo que resolvido).')) return;
    setCancellingId(id);
    try {
      await cancelMissingProduct(id);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <AdminPageHeader
          icon={ClipboardCheck}
          title="Faltantes"
          description="Registre produtos que estão acabando e acompanhe o que ainda precisa ser resolvido."
          action={
            <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
              <DialogTrigger asChild>
                <Button onClick={openReportDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Reportar falta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto overscroll-contain">
                <DialogHeader>
                  <DialogTitle>Reportar produtos faltando</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {rows.map((row) => (
                    <div key={row.key} className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <ProductPicker
                          products={products}
                          value={row.productId}
                          onChange={(productId) =>
                            updateRow(row.key, (r) => ({ ...r, productId, fragranceId: null, variationId: null }))
                          }
                        />
                        <FragranceVariationFields
                          product={row.productId ? productById.get(row.productId) : undefined}
                          fragranceId={row.fragranceId}
                          variationId={row.variationId}
                          onFragranceChange={(fragranceId) =>
                            updateRow(row.key, (r) => ({ ...r, fragranceId, variationId: null }))
                          }
                          onVariationChange={(variationId) => updateRow(row.key, (r) => ({ ...r, variationId }))}
                        />
                        <div className="space-y-1">
                          <Label htmlFor={`stock-${row.key}`} className="text-xs text-muted-foreground">
                            Quantos ainda tem (opcional)
                          </Label>
                          <Input
                            id={`stock-${row.key}`}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={row.stockRemaining}
                            onChange={(e) => updateRow(row.key, (r) => ({ ...r, stockRemaining: e.target.value }))}
                          />
                        </div>
                      </div>
                      {rows.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-1"
                          aria-label="Remover produto"
                          onClick={() => removeRow(row.key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addRow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar outro produto
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !hasChosenProduct || hasIncompleteRow || displayNameStatus !== 'ready'}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <AdminLoadingState rows={3} tone="light" />
        ) : missingProducts.length === 0 ? (
          <AdminEmptyState icon={ClipboardCheck} title="Nenhum produto faltando no momento." tone="light" />
        ) : (
          <div className="space-y-3">
            {missingProducts.map((item) => {
              const product = productById.get(item.product_id);
              const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
              const inQuote = openItemIds.has(item.id);
              return (
                <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium flex items-center gap-2 flex-wrap">
                      {displayName}
                      {inQuote && <Badge variant="secondary" className="text-xs">Em cotação</Badge>}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.stock_remaining !== null ? `${item.stock_remaining} restando` : 'Quantidade não informada'}
                      {' · '}
                      Reportado por {item.reported_by_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium bg-blue-100 text-blue-800 rounded-full px-2 py-1">
                      pedido {item.report_count}x
                    </span>
                    {canResolve && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolvingId === item.id}
                        onClick={() => handleResolve(item.id)}
                      >
                        Marcar como resolvido
                      </Button>
                    )}
                    {canResolve && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        aria-label="Cancelar item (produto errado, não é uma compra resolvida)"
                        disabled={cancellingId === item.id}
                        onClick={() => handleCancel(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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

export default MissingProductsManager;
