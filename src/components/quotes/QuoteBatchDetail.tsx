import { useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { useQuoteBatchDetail } from '@/hooks/useQuoteBatchDetail';
import { useSuppliers } from '@/hooks/useSuppliers';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';
import QuoteBatchSupplierReview from './QuoteBatchSupplierReview';

interface AddSupplierDialogProps {
  existingSupplierIds: Set<string>;
  onAdd: (supplierId: string) => Promise<void>;
}

const AddSupplierDialog = ({ existingSupplierIds, onAdd }: AddSupplierDialogProps) => {
  const { suppliers, loading } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const available = suppliers.filter((s) => !existingSupplierIds.has(s.id));

  const handleAdd = async (supplierId: string) => {
    setAddingId(supplierId);
    try {
      await onAdd(supplierId);
      setOpen(false);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar fornecedor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar fornecedor ao lote</DialogTitle>
        </DialogHeader>
        {loading ? (
          <AdminLoadingState rows={2} tone="light" />
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os fornecedores cadastrados já estão neste lote.</p>
        ) : (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {available.map((supplier) => (
              <button
                key={supplier.id}
                onClick={() => handleAdd(supplier.id)}
                disabled={addingId !== null}
                className="w-full text-left p-2 rounded hover:bg-muted/50 text-sm disabled:opacity-50"
              >
                {supplier.company_name} ({supplier.contact_name})
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface QuoteBatchDetailProps {
  batchId: string;
  products: ProductWithVariations[];
  onBack: () => void;
  onCompare: (batchId: string) => void;
}

const QuoteBatchDetail = ({ batchId, products, onBack, onCompare }: QuoteBatchDetailProps) => {
  const { batch, items, suppliers, loading, cancelBatch, addSupplier, refetch } = useQuoteBatchDetail(batchId);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const productById = new Map(products.map((p) => [p.id, p]));

  if (selectedSupplierId) {
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    return (
      <QuoteBatchSupplierReview
        quoteBatchSupplierId={selectedSupplierId}
        supplierName={supplier?.company_name ?? 'Fornecedor'}
        items={items}
        products={products}
        batchStatus={batch.status}
        onBack={() => {
          setSelectedSupplierId(null);
          refetch();
        }}
      />
    );
  }

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelBatch();
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading || !batch) {
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
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/10">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            {batch.status !== 'cancelado' && (
              <Button variant="secondary" size="sm" onClick={() => onCompare(batchId)}>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                {batch.status === 'concluido' ? 'Ver comparação' : 'Comparar e gerar pedido'}
              </Button>
            )}
            {batch.status === 'aberto' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isCancelling}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar lote
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar esta cotação?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os itens voltam a ficar disponíveis pra entrar em um lote novo. O histórico deste lote continua
                      salvo, só não aparece mais como aberto.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>Cancelar lote</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-heading text-white">
            Lote de {batch.created_by_name}
            {batch.status === 'cancelado' && <Badge variant="outline" className="ml-2">Cancelado</Badge>}
            {batch.status === 'concluido' && <Badge className="ml-2">Concluído</Badge>}
          </h2>
          <p className="text-sm text-blue-300/60 mt-1">
            Criado em{' '}
            {new Date(batch.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Itens ({items.length})</p>
          <div className="space-y-1">
            {items.map((item) => {
              const product = productById.get(item.product_id);
              const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
              return (
                <p key={item.id} className="text-sm text-muted-foreground">
                  {item.quantity}x {displayName}
                </p>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Fornecedores ({suppliers.length})</p>
            {batch.status === 'aberto' && (
              <AddSupplierDialog existingSupplierIds={new Set(suppliers.map((s) => s.supplier_id))} onAdd={addSupplier} />
            )}
          </div>
          <div className="space-y-2">
            {suppliers.map((supplier) => (
              <button
                key={supplier.id}
                onClick={() => setSelectedSupplierId(supplier.id)}
                className="w-full text-left border rounded-lg p-3 flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">{supplier.company_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {supplier.filled_count} de {items.length} preenchido(s)
                  </p>
                </div>
                <Badge variant={supplier.status === 'revisado' ? 'default' : 'secondary'}>
                  {supplier.status === 'revisado' ? 'Revisado' : 'Pendente'}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteBatchDetail;
