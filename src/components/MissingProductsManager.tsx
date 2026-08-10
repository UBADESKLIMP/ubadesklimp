import { useState } from 'react';
import { Plus, X, Check, ChevronsUpDown, ClipboardCheck } from 'lucide-react';
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
import { useMissingProducts, MissingProductReportItem } from '@/hooks/useMissingProducts';
import { ProductWithVariations } from '@/types/product';
import { StaffAccess } from '@/hooks/useStaffAccess';
import AdminLoadingState from './admin/AdminLoadingState';
import AdminEmptyState from './admin/AdminEmptyState';
import AdminPageHeader from './admin/AdminPageHeader';
import { cn } from '@/lib/utils';

interface ReportRow {
  key: string;
  productId: string | null;
  stockRemaining: string;
}

const emptyRow = (): ReportRow => ({
  key: crypto.randomUUID(),
  productId: null,
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
  excludeIds: string[];
  value: string | null;
  onChange: (productId: string) => void;
}

// Combobox pesquisável — padrão shadcn (Popover + Command). excludeIds tira
// da lista os produtos já escolhidos em OUTRAS linhas do lote atual, pra não
// deixar reportar o mesmo produto duas vezes na mesma leva.
const ProductPicker = ({ products, excludeIds, value, onChange }: ProductPickerProps) => {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);
  const available = products.filter((p) => p.id === value || !excludeIds.includes(p.id));

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
        <Command>
          <CommandInput placeholder="Buscar produto..." />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              {available.map((product) => (
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

interface MissingProductsManagerProps {
  products: ProductWithVariations[];
  staffAccess: StaffAccess;
}

const MissingProductsManager = ({ products, staffAccess }: MissingProductsManagerProps) => {
  const { missingProducts, loading, reportMissingProducts, resolveMissingProduct, displayNameStatus } =
    useMissingProducts();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([emptyRow()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const canResolve =
    staffAccess.isAdmin || (staffAccess.permissions.has('faltantes') && staffAccess.permissions.has('fornecedores'));
  const productById = new Map(products.map((p) => [p.id, p]));
  const chosenProductIds = rows.map((r) => r.productId).filter((id): id is string => id !== null);
  const hasChosenProduct = chosenProductIds.length > 0;

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
      .map((row) => ({ productId: row.productId as string, stockRemaining: toNullableInt(row.stockRemaining) }));

    if (items.length === 0) return;

    setIsSubmitting(true);
    try {
      const { succeeded } = await reportMissingProducts(items);
      const stillPending = rows.filter((row) => row.productId !== null && !succeeded.includes(row.productId));

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
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Reportar produtos faltando</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {rows.map((row) => (
                    <div key={row.key} className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <ProductPicker
                          products={products}
                          excludeIds={chosenProductIds.filter((id) => id !== row.productId)}
                          value={row.productId}
                          onChange={(productId) => updateRow(row.key, (r) => ({ ...r, productId }))}
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
                    disabled={isSubmitting || !hasChosenProduct || displayNameStatus !== 'ready'}
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
              return (
                <div key={item.id} className="border rounded-lg p-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{product?.name || 'Produto removido'}</p>
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
