import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useQuoteBatches } from '@/hooks/useQuoteBatches';
import { useMissingProducts } from '@/hooks/useMissingProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useExclusiveBrands } from '@/hooks/useExclusiveBrands';
import { buildMissingItemDisplayName, compareMissingItems } from '@/lib/missingProductDisplay';
import { normalizeText } from '@/lib/utils';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';

// Dica de "quanto costumo comprar" salva na aba Compras do produto — ajuda
// na hora de decidir a quantidade da cotação sem precisar sair daqui.
const buildPurchaseHint = (product: ProductWithVariations | undefined): string | null => {
  const min = product?.purchase_min_quantity;
  const max = product?.purchase_max_quantity;
  if (min && max) return `Compra: ${min} – ${max}`;
  if (min || max) return `Compra: ${min || max}`;
  return null;
};

const STEP_TITLES = ['O que vamos pedir?', 'Para quem vamos pedir?', 'Confira e crie'];

interface NovaCotacaoDialogProps {
  products: ProductWithVariations[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (batchId: string) => void;
}

const NovaCotacaoDialog = ({ products, open, onOpenChange, onCreated }: NovaCotacaoDialogProps) => {
  const { missingProducts: allMissingProducts, loading: loadingMissing } = useMissingProducts();
  const { exclusiveBrands } = useExclusiveBrands();
  const { suppliers, loading: loadingSuppliers } = useSuppliers();
  const { openItemIds, createBatch } = useQuoteBatches();
  const [step, setStep] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Map<string, number | null>>(new Map());
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preselected, setPreselected] = useState(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Produto de marca exclusiva tem fornecedor fixo e vai direto a ele (aba
  // Faltantes > Marca exclusiva). Não faz sentido pedir preço a vários
  // fornecedores, então sai desta lista.
  const exclusiveBrandNames = new Set(exclusiveBrands.map((eb) => normalizeText(eb.brand)));
  const isExclusiveItem = (item: (typeof allMissingProducts)[number]) => {
    const brand = productById.get(item.product_id)?.brand;
    return !!(brand && exclusiveBrandNames.has(normalizeText(brand)));
  };
  const hiddenExclusiveCount = allMissingProducts.filter(isExclusiveItem).length;

  // Mais avisados primeiro; dentro do mesmo número, variações do mesmo
  // produto ficam juntas.
  const missingProducts = allMissingProducts
    .filter((item) => !isExclusiveItem(item))
    .sort((a, b) => {
      if (b.report_count !== a.report_count) return b.report_count - a.report_count;
      return compareMissingItems(
        { product: productById.get(a.product_id), fragranceId: a.fragrance_id, variationId: a.variation_id },
        { product: productById.get(b.product_id), fragranceId: b.fragrance_id, variationId: b.variation_id }
      );
    });

  // "já em cotação" fica desabilitado e não entra na seleção em massa.
  const selectableItems = missingProducts.filter((item) => !openItemIds.has(item.id));
  const allItemsSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedItems.has(item.id));
  const allSuppliersSelected = suppliers.length > 0 && suppliers.every((s) => selectedSupplierIds.has(s.id));

  // Ao abrir, os itens já vêm marcados: o caso comum é cotar tudo o que falta.
  useEffect(() => {
    if (!open) {
      setPreselected(false);
      return;
    }
    if (preselected || loadingMissing || selectableItems.length === 0) return;
    setSelectedItems(new Map(selectableItems.map((item) => [item.id, null])));
    setPreselected(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loadingMissing, selectableItems.length, preselected]);

  const reset = () => {
    setStep(0);
    setSelectedItems(new Map());
    setSelectedSupplierIds(new Set());
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, null);
      return next;
    });
  };

  const setItemQuantity = (id: string, quantity: number | null) => {
    setSelectedItems((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, quantity);
      return next;
    });
  };

  const toggleSupplier = (id: string) => {
    setSelectedSupplierIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllItems = () => {
    setSelectedItems((prev) => {
      if (allItemsSelected) return new Map();
      const next = new Map(prev);
      selectableItems.forEach((item) => {
        if (!next.has(item.id)) next.set(item.id, null);
      });
      return next;
    });
  };

  const toggleAllSuppliers = () => {
    setSelectedSupplierIds(allSuppliersSelected ? new Set() : new Set(suppliers.map((s) => s.id)));
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      const items = Array.from(selectedItems.entries()).map(([missingProductId, quantity]) => ({
        missingProductId,
        quantity,
      }));
      const batchId = await createBatch(items, Array.from(selectedSupplierIds));
      if (batchId) {
        reset();
        onOpenChange(false);
        onCreated(batchId);
      }
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSubmitting(false);
    }
  };

  const chosenItems = missingProducts.filter((item) => selectedItems.has(item.id));
  const chosenSuppliers = suppliers.filter((s) => selectedSupplierIds.has(s.id));
  const canContinue = step === 0 ? selectedItems.size > 0 : step === 1 ? selectedSupplierIds.size > 0 : true;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova cotação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Passo {step + 1} de {STEP_TITLES.length}
          </p>
          <DialogTitle className="text-2xl">{STEP_TITLES[step]}</DialogTitle>
          <DialogDescription className="sr-only">Criar uma nova cotação em três passos.</DialogDescription>
          <div className="flex gap-1.5 pt-1" aria-hidden>
            {STEP_TITLES.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full ${index <= step ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
        </DialogHeader>

        {step === 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Tire a marca dos produtos que não quer pedir agora. Os mais avisados aparecem primeiro.
              </p>
              {selectableItems.length > 0 && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-sm shrink-0" onClick={toggleAllItems}>
                  {allItemsSelected ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              )}
            </div>
            {hiddenExclusiveCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {hiddenExclusiveCount} {hiddenExclusiveCount === 1 ? 'item não aparece' : 'itens não aparecem'} aqui
                porque {hiddenExclusiveCount === 1 ? 'é de' : 'são de'} marca com fornecedor fixo. Eles vão direto
                ao fornecedor, na aba Faltantes &gt; Marca exclusiva.
              </p>
            )}
            {loadingMissing ? (
              <AdminLoadingState rows={2} tone="light" />
            ) : missingProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item pendente em Faltantes.</p>
            ) : (
              <div className="space-y-1 max-h-[45vh] overflow-y-auto border rounded-md p-2">
                {missingProducts.map((item) => {
                  const product = productById.get(item.product_id);
                  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                  const alreadyInQuote = openItemIds.has(item.id);
                  const isSelected = selectedItems.has(item.id);
                  const purchaseHint = buildPurchaseHint(product);
                  return (
                    <label
                      key={item.id}
                      title={product?.purchase_notes || undefined}
                      className={`flex items-center gap-3 p-2 rounded min-h-[44px] ${alreadyInQuote ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
                    >
                      <Checkbox
                        className="h-5 w-5"
                        checked={isSelected}
                        disabled={alreadyInQuote}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <span className="text-sm flex-1">
                        {displayName}
                        {purchaseHint && <span className="block text-xs text-muted-foreground">{purchaseHint}</span>}
                      </span>
                      {item.report_count > 1 && !alreadyInQuote && (
                        <Badge variant="secondary" className="text-xs">avisado {item.report_count}x</Badge>
                      )}
                      {isSelected && (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          placeholder="Qtd (opcional)"
                          className="w-28 h-9 text-xs"
                          value={selectedItems.get(item.id) ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setItemQuantity(item.id, null);
                              return;
                            }
                            const parsed = parseInt(raw, 10);
                            setItemQuantity(item.id, Number.isNaN(parsed) ? null : Math.max(1, parsed));
                          }}
                        />
                      )}
                      {alreadyInQuote && <Badge variant="secondary" className="text-xs">já em cotação</Badge>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">Marque os fornecedores que vão mandar preço.</p>
              {suppliers.length > 0 && (
                <Button type="button" variant="link" size="sm" className="h-auto p-0 text-sm shrink-0" onClick={toggleAllSuppliers}>
                  {allSuppliersSelected ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              )}
            </div>
            {loadingSuppliers ? (
              <AdminLoadingState rows={2} tone="light" />
            ) : suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
            ) : (
              <div className="space-y-1 max-h-[45vh] overflow-y-auto border rounded-md p-2">
                {suppliers.map((supplier) => (
                  <label key={supplier.id} className="flex items-center gap-3 p-2 rounded min-h-[44px] cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      className="h-5 w-5"
                      checked={selectedSupplierIds.has(supplier.id)}
                      onCheckedChange={() => toggleSupplier(supplier.id)}
                    />
                    <span className="text-sm">{supplier.company_name} ({supplier.contact_name})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm">
              Vamos pedir preço de <strong>{chosenItems.length}</strong>{' '}
              {chosenItems.length === 1 ? 'produto' : 'produtos'} para <strong>{chosenSuppliers.length}</strong>{' '}
              {chosenSuppliers.length === 1 ? 'fornecedor' : 'fornecedores'}.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border rounded-md p-3 max-h-[35vh] overflow-y-auto">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Produtos</p>
                <ul className="text-sm space-y-1">
                  {chosenItems.map((item) => (
                    <li key={item.id}>
                      {buildMissingItemDisplayName(productById.get(item.product_id), item.fragrance_id, item.variation_id)}
                      {selectedItems.get(item.id) ? ` · ${selectedItems.get(item.id)}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border rounded-md p-3 max-h-[35vh] overflow-y-auto">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Fornecedores</p>
                <ul className="text-sm space-y-1">
                  {chosenSuppliers.map((supplier) => (
                    <li key={supplier.id}>{supplier.company_name} ({supplier.contact_name})</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Depois de criar, você manda o pedido de preço para cada fornecedor pelo WhatsApp e anota o que eles responderem.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={isSubmitting}>
              Voltar
            </Button>
          )}
          {step < STEP_TITLES.length - 1 ? (
            <Button type="button" size="lg" onClick={() => setStep(step + 1)} disabled={!canContinue}>
              Continuar
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar cotação'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovaCotacaoDialog;
