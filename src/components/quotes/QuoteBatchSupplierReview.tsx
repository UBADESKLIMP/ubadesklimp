import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, RotateCcw, Sparkles, Check, ClipboardPaste, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuoteSupplierReview } from '@/hooks/useQuoteSupplierReview';
import { buildMissingItemDisplayName } from '@/lib/missingProductDisplay';
import { parseQuoteRequestExcel } from '@/lib/quoteExcel';
import { toast } from '@/hooks/use-toast';
import { QuoteBatchDetailItem } from '@/hooks/useQuoteBatchDetail';
import { ProductWithVariations } from '@/types/product';
import AdminLoadingState from '../admin/AdminLoadingState';

interface QuoteBatchSupplierReviewProps {
  quoteBatchSupplierId: string;
  supplierName: string;
  items: QuoteBatchDetailItem[];
  products: ProductWithVariations[];
  batchStatus: 'aberto' | 'cancelado' | 'concluido';
  onBack: () => void;
}

const QuoteBatchSupplierReview = ({
  quoteBatchSupplierId,
  supplierName,
  items,
  products,
  batchStatus,
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
    updateNote,
    markReviewed,
  } = useQuoteSupplierReview(quoteBatchSupplierId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [isPasteOpen, setIsPasteOpen] = useState(false);
  const [pastedTextValue, setPastedTextValue] = useState('');
  const [importingExcel, setImportingExcel] = useState(false);

  const isReadOnly = batchStatus !== 'aberto';
  const busy = uploading || extracting || importingExcel;

  const productById = new Map(products.map((p) => [p.id, p]));
  const lineItemByItemId = new Map(lineItems.map((li) => [li.quote_batch_item_id, li]));

  // Não pode substituir draftPrices inteiro toda vez que lineItems muda —
  // updatePrice troca a identidade do array a cada save bem-sucedido, o que
  // refaz este efeito e, sem essa checagem, apagava o que a pessoa estivesse
  // digitando na PRÓXIMA célula enquanto o salvamento da célula anterior
  // ainda estava em voo. Pula a célula que está em foco agora.
  useEffect(() => {
    setDraftPrices((prev) => {
      const next = { ...prev };
      for (const li of lineItems) {
        if (li.quote_batch_item_id === focusedItemId) continue;
        next[li.quote_batch_item_id] = li.price != null ? String(li.price) : '';
      }
      return next;
    });
    setDraftNotes((prev) => {
      const next = { ...prev };
      for (const li of lineItems) {
        if (li.quote_batch_item_id === focusedItemId) continue;
        next[li.quote_batch_item_id] = li.notes ?? '';
      }
      return next;
    });
  }, [lineItems, focusedItemId]);

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

  const handleNoteBlur = (quoteBatchItemId: string) => {
    const raw = (draftNotes[quoteBatchItemId] ?? '').trim();
    updateNote(quoteBatchItemId, raw === '' ? null : raw);
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

  const handleExtractFromText = async () => {
    const trimmed = pastedTextValue.trim();
    if (trimmed === '') return;
    const ok = await runExtraction(trimmed);
    if (!ok) return;
    setPastedTextValue('');
    setIsPasteOpen(false);
  };

  const handleExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (excelInputRef.current) excelInputRef.current.value = '';
    if (!file) return;

    setImportingExcel(true);
    try {
      const rows = await parseQuoteRequestExcel(file);
      const knownItemIds = new Set(items.map((item) => item.id));
      let applied = 0;
      for (const row of rows) {
        if (!knownItemIds.has(row.itemId)) continue;
        if (row.price === null && row.note === null) continue;
        if (row.price !== null) {
          await updatePrice(row.itemId, row.price);
        }
        if (row.note !== null) {
          await updateNote(row.itemId, row.note);
        }
        applied += 1;
      }
      if (applied === 0) {
        toast({
          title: 'Nenhum item aplicado',
          description: 'Nenhuma linha reconhecida — a coluna de ID pode ter sido removida. Exporte a planilha de novo e peça pro fornecedor preencher essa mesma cópia.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Planilha importada',
          description: `${applied} de ${rows.length} item(ns) preenchido(s).`,
        });
      }
    } catch (error) {
      console.error('Error importing quote excel:', error);
      toast({ title: 'Erro ao importar', description: 'Não foi possível ler essa planilha.', variant: 'destructive' });
    } finally {
      setImportingExcel(false);
    }
  };

  return (
    <Card>
      <CardHeader className="bg-[#12121a] border-b border-blue-500/20 rounded-t-lg space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/10">
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
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isReadOnly}
                      onClick={() => reprocessFile(file.id)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Processar de novo
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              multiple
              onChange={handleFileChange}
              disabled={busy || isReadOnly}
              className="hidden"
              id="quote-file-upload"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy || isReadOnly}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Enviar arquivo(s)'}
            </Button>
            <Button size="sm" disabled={busy || unprocessedCount === 0 || isReadOnly} onClick={() => runExtraction()}>
              <Sparkles className="h-4 w-4 mr-2" />
              {extracting ? 'Extraindo...' : `Extrair com IA (${unprocessedCount} novo(s))`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || isReadOnly}
              onClick={() => setIsPasteOpen((prev) => !prev)}
            >
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Colar texto
            </Button>
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelChange}
              disabled={busy || isReadOnly}
              className="hidden"
              id="quote-excel-upload"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy || isReadOnly}
              onClick={() => excelInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {importingExcel ? 'Importando...' : 'Importar Excel'}
            </Button>
          </div>
          {isPasteOpen && (
            <div className="space-y-2 border rounded-md p-3">
              <Textarea
                placeholder="Cole aqui o texto que o fornecedor mandou no WhatsApp..."
                value={pastedTextValue}
                onChange={(e) => setPastedTextValue(e.target.value)}
                disabled={extracting || isReadOnly}
                rows={6}
                maxLength={20000}
              />
              <Button
                size="sm"
                disabled={busy || pastedTextValue.trim() === '' || isReadOnly}
                onClick={handleExtractFromText}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {extracting ? 'Extraindo...' : 'Extrair do texto colado'}
              </Button>
            </div>
          )}
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
                  <TableHead className="w-56">Adendo do fornecedor</TableHead>
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
                          disabled={isReadOnly}
                          onChange={(e) => setDraftPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onFocus={() => setFocusedItemId(item.id)}
                          onBlur={() => {
                            setFocusedItemId((current) => (current === item.id ? null : current));
                            handlePriceBlur(item.id);
                          }}
                        />
                        {lineItem && lineItem.price !== null && (
                          <p className="text-xs text-muted-foreground mt-1">por {lineItem.updated_by_name}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="text"
                          placeholder="Ex: confirmou 3L"
                          value={draftNotes[item.id] ?? ''}
                          disabled={isReadOnly}
                          onChange={(e) => setDraftNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          onFocus={() => setFocusedItemId(item.id)}
                          onBlur={() => {
                            setFocusedItemId((current) => (current === item.id ? null : current));
                            handleNoteBlur(item.id);
                          }}
                        />
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
