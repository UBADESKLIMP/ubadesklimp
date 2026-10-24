import { useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { useExclusiveBrands } from '@/hooks/useExclusiveBrands';
import { normalizeText } from '@/lib/utils';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';
import AdminEmptyState from '../admin/AdminEmptyState';
import AdminPageHeader from '../admin/AdminPageHeader';
import QuoteBatchDetail from './QuoteBatchDetail';
import QuoteBatchComparison from './QuoteBatchComparison';
import NovaCotacaoDialog from './NovaCotacaoDialog';

interface CotacoesManagerProps {
  products: ProductWithVariations[];
}

const CotacoesManager = ({ products }: CotacoesManagerProps) => {
  const { batches, loading, deleteBatch, refetch } = useQuoteBatches();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [compareBatchId, setCompareBatchId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (batch: (typeof batches)[number]) => {
    if (!window.confirm('Excluir essa cotação cancelada? Essa ação não pode ser desfeita.')) return;
    setDeletingId(batch.id);
    try {
      await deleteBatch(batch.id);
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setDeletingId(null);
    }
  };

  if (compareBatchId) {
    return (
      <QuoteBatchComparison
        batchId={compareBatchId}
        products={products}
        onBack={() => {
          setCompareBatchId(null);
          refetch();
        }}
      />
    );
  }

  if (selectedBatchId) {
    return (
      <QuoteBatchDetail
        batchId={selectedBatchId}
        products={products}
        onBack={() => {
          setSelectedBatchId(null);
          refetch();
        }}
        onCompare={(batchId) => setCompareBatchId(batchId)}
      />
    );
  }

  const openBatches = batches.filter((b) => b.status === 'aberto');
  const completedBatches = batches.filter((b) => b.status === 'concluido');
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
    <div
      key={batch.id}
      className="w-full border rounded-lg p-4 flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors"
    >
      <button onClick={() => setSelectedBatchId(batch.id)} className="flex-1 text-left min-w-0">
        <p className="font-medium">
          {batch.item_count} item(ns) · {batch.supplier_count} fornecedor(es)
        </p>
        <p className="text-sm text-muted-foreground">
          Criado por {batch.created_by_name} em {formatDate(batch.created_at)} ·{' '}
          {batch.suppliers_reviewed_count} de {batch.supplier_count} revisado(s)
        </p>
      </button>
      <div className="flex items-center gap-2 shrink-0">
        {batch.status === 'cancelado' && <Badge variant="outline">Cancelado</Badge>}
        {batch.status === 'concluido' && <Badge>Concluído</Badge>}
        {batch.status === 'cancelado' && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir cotação cancelada"
            disabled={deletingId === batch.id}
            onClick={() => handleDelete(batch)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <AdminPageHeader
          icon={Receipt}
          title="Cotações"
          description="Peça preço pra vários fornecedores de uma vez e deixe a IA ler os arquivos que eles mandarem."
          action={<NovaCotacaoDialog products={products} open={isCreateOpen} onOpenChange={setIsCreateOpen} onCreated={setSelectedBatchId} />}
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
        {completedBatches.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
            {completedBatches.map(renderBatchCard)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CotacoesManager;
