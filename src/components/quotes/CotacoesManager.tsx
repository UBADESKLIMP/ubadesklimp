import { useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useQuoteBatches } from '@/hooks/useQuoteBatches';
import { useMissingProducts } from '@/hooks/useMissingProducts';
import { useSuppliers } from '@/hooks/useSuppliers';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';
import AdminEmptyState from '../admin/AdminEmptyState';
import AdminPageHeader from '../admin/AdminPageHeader';
import QuoteBatchDetail from './QuoteBatchDetail';

interface CreateQuoteBatchDialogProps {
  products: ProductWithVariations[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (batchId: string) => void;
}

const CreateQuoteBatchDialog = ({ products, open, onOpenChange, onCreated }: CreateQuoteBatchDialogProps) => {
  const { missingProducts, loading: loadingMissing } = useMissingProducts();
  const { suppliers, loading: loadingSuppliers } = useSuppliers();
  const { openItemIds, createBatch } = useQuoteBatches();
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productById = new Map(products.map((p) => [p.id, p]));

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      const batchId = await createBatch(Array.from(selectedItemIds), Array.from(selectedSupplierIds));
      if (batchId) {
        setSelectedItemIds(new Set());
        setSelectedSupplierIds(new Set());
        onOpenChange(false);
        onCreated(batchId);
      }
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nova cotação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova cotação</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-medium">Itens faltantes</p>
            {loadingMissing ? (
              <AdminLoadingState rows={2} tone="light" />
            ) : missingProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item pendente em Faltantes.</p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto border rounded-md p-2">
                {missingProducts.map((item) => {
                  const product = productById.get(item.product_id);
                  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                  const alreadyInQuote = openItemIds.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 p-1.5 rounded ${alreadyInQuote ? 'opacity-50' : 'cursor-pointer hover:bg-muted/50'}`}
                    >
                      <Checkbox
                        checked={selectedItemIds.has(item.id)}
                        disabled={alreadyInQuote}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <span className="text-sm">{displayName}</span>
                      {alreadyInQuote && (
                        <Badge variant="secondary" className="text-xs">já em cotação</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Fornecedores</p>
            {loadingSuppliers ? (
              <AdminLoadingState rows={2} tone="light" />
            ) : suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto border rounded-md p-2">
                {suppliers.map((supplier) => (
                  <label key={supplier.id} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={selectedSupplierIds.has(supplier.id)} onCheckedChange={() => toggleSupplier(supplier.id)} />
                    <span className="text-sm">{supplier.company_name} ({supplier.contact_name})</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={isSubmitting || selectedItemIds.size === 0 || selectedSupplierIds.size === 0}
          >
            {isSubmitting ? 'Criando...' : 'Criar cotação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface CotacoesManagerProps {
  products: ProductWithVariations[];
}

const CotacoesManager = ({ products }: CotacoesManagerProps) => {
  const { batches, loading, refetch } = useQuoteBatches();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  if (selectedBatchId) {
    return (
      <QuoteBatchDetail
        batchId={selectedBatchId}
        products={products}
        onBack={() => {
          setSelectedBatchId(null);
          refetch();
        }}
      />
    );
  }

  const openBatches = batches.filter((b) => b.status === 'aberto');
  const cancelledBatches = batches.filter((b) => b.status === 'cancelado');

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderBatchCard = (batch: (typeof batches)[number]) => (
    <button
      key={batch.id}
      onClick={() => setSelectedBatchId(batch.id)}
      className="w-full text-left border rounded-lg p-4 flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors"
    >
      <div>
        <p className="font-medium">
          {batch.item_count} item(ns) · {batch.supplier_count} fornecedor(es)
        </p>
        <p className="text-sm text-muted-foreground">
          Criado por {batch.created_by_name} em {formatDate(batch.created_at)} ·{' '}
          {batch.suppliers_reviewed_count} de {batch.supplier_count} revisado(s)
        </p>
      </div>
      {batch.status === 'cancelado' && <Badge variant="outline">Cancelado</Badge>}
    </button>
  );

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <AdminPageHeader
          icon={Receipt}
          title="Cotações"
          description="Peça preço pra vários fornecedores de uma vez e deixe a IA ler os arquivos que eles mandarem."
          action={<CreateQuoteBatchDialog products={products} open={isCreateOpen} onOpenChange={setIsCreateOpen} onCreated={setSelectedBatchId} />}
        />
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {loading ? (
          <AdminLoadingState rows={3} tone="light" />
        ) : openBatches.length === 0 ? (
          <AdminEmptyState icon={Receipt} title="Nenhuma cotação em aberto." tone="light" />
        ) : (
          <div className="space-y-3">{openBatches.map(renderBatchCard)}</div>
        )}
        {cancelledBatches.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Canceladas</p>
            {cancelledBatches.map(renderBatchCard)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CotacoesManager;
