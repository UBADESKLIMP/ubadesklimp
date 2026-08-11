import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, RotateCcw, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuoteSupplierReview } from '@/hooks/useQuoteSupplierReview';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { QuoteBatchDetailItem } from '@/hooks/useQuoteBatchDetail';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';

interface QuoteBatchSupplierReviewProps {
  quoteBatchSupplierId: string;
  supplierName: string;
  items: QuoteBatchDetailItem[];
  products: ProductWithVariations[];
  onBack: () => void;
}

const QuoteBatchSupplierReview = ({
  quoteBatchSupplierId,
  supplierName,
  items,
  products,
  onBack,
}: QuoteBatchSupplierReviewProps) => {
  const {
    files,
    lineItems,
    loading,
    uploading,
    extracting,
    uploadFiles,
    reprocessFile,
    runExtraction,
    updatePrice,
    markReviewed,
  } = useQuoteSupplierReview(quoteBatchSupplierId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [isMarking, setIsMarking] = useState(false);

  const productById = new Map(products.map((p) => [p.id, p]));
  const lineItemByItemId = new Map(lineItems.map((li) => [li.quote_batch_item_id, li]));

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const li of lineItems) {
      next[li.quote_batch_item_id] = li.price != null ? String(li.price) : '';
    }
    setDraftPrices(next);
  }, [lineItems]);

  const unprocessedCount = files.filter((f) => !f.processed_at).length;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length > 0) {
      await uploadFiles(selected);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePriceBlur = (quoteBatchItemId: string) => {
    const raw = (draftPrices[quoteBatchItemId] ?? '').trim();
    if (raw === '') {
      updatePrice(quoteBatchItemId, null);
      return;
    }
    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      updatePrice(quoteBatchItemId, parsed);
    }
  };

  const handleMarkReviewed = async () => {
    setIsMarking(true);
    try {
      await markReviewed();
    } catch {
      // erro já mostrado via toast dentro do hook
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button size="sm" onClick={handleMarkReviewed} disabled={isMarking}>
            <Check className="h-4 w-4 mr-2" />
            Marcar como revisado
          </Button>
        </div>
        <h2 className="text-2xl font-heading text-white">{supplierName}</h2>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">Arquivos da cotação</p>
          <div className="space-y-1">
            {files.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-2 border rounded-md p-2 text-sm">
                <span className="truncate">{file.storage_path.split('/').pop()}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={file.processed_at ? 'default' : 'secondary'}>
                    {file.processed_at ? 'Processado' : 'Novo'}
                  </Badge>
                  {file.processed_at && (
                    <Button variant="outline" size="sm" onClick={() => reprocessFile(file.id)}>
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Processar de novo
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
              id="quote-file-upload"
            />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Enviar arquivo(s)'}
            </Button>
            <Button size="sm" disabled={extracting || unprocessedCount === 0} onClick={runExtraction}>
              <Sparkles className="h-4 w-4 mr-2" />
              {extracting ? 'Extraindo...' : `Extrair com IA (${unprocessedCount} novo(s))`}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Preços</p>
          {loading ? (
            <AdminLoadingState rows={3} tone="light" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-40">Preço (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const product = productById.get(item.product_id);
                  const displayName = buildMissingItemDisplayName(product, item.fragrance_id, item.variation_id);
                  const lineItem = lineItemByItemId.get(item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{displayName}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="—"
                          value={draftPrices[item.id] ?? ''}
                          onChange={(e) => setDraftPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => handlePriceBlur(item.id)}
                        />
                        {lineItem && (
                          <p className="text-xs text-muted-foreground mt-1">por {lineItem.updated_by_name}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteBatchSupplierReview;
