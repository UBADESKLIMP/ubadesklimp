import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useCurrentStaffName } from '@/hooks/useCurrentStaffName';
import { extractFunctionErrorMessage } from '@/lib/functionErrors';

export interface QuoteFile {
  id: string;
  storage_path: string;
  uploaded_by_name: string;
  processed_at: string | null;
  created_at: string;
}

export interface QuoteLineItem {
  id: string;
  quote_batch_item_id: string;
  price: number | null;
  notes: string | null;
  updated_by_name: string;
  updated_at: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export const useQuoteSupplierReview = (quoteBatchSupplierId: string) => {
  const { user } = useAuth();
  const { displayName } = useCurrentStaffName();
  const [files, setFiles] = useState<QuoteFile[]>([]);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [filesResult, lineItemsResult] = await Promise.all([
        supabase
          .from('quote_files')
          .select('id, storage_path, uploaded_by_name, processed_at, created_at')
          .eq('quote_batch_supplier_id', quoteBatchSupplierId)
          .order('created_at'),
        supabase
          .from('quote_line_items')
          .select('id, quote_batch_item_id, price, notes, updated_by_name, updated_at')
          .eq('quote_batch_supplier_id', quoteBatchSupplierId),
      ]);

      if (filesResult.error) throw filesResult.error;
      if (lineItemsResult.error) throw lineItemsResult.error;

      setFiles((filesResult.data as QuoteFile[]) || []);
      setLineItems((lineItemsResult.data as QuoteLineItem[]) || []);
    } catch (error) {
      console.error('Error fetching quote supplier review data:', error);
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar os arquivos e preços deste fornecedor.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [quoteBatchSupplierId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const uploadFiles = async (fileList: File[]) => {
    if (!user) throw new Error('Usuário não autenticado');
    if (!displayName) {
      toast({
        title: 'Aguarde',
        description: 'Carregando seu nome de exibição, tente de novo em instantes.',
        variant: 'destructive',
      });
      return;
    }

    const validFiles = fileList.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({ title: 'Tipo de arquivo inválido', description: `"${file.name}" não é imagem nem PDF.`, variant: 'destructive' });
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({ title: 'Arquivo muito grande', description: `"${file.name}" deve ter no máximo 15MB.`, variant: 'destructive' });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of validFiles) {
        const ext = EXT_BY_TYPE[file.type];
        const storagePath = `${quoteBatchSupplierId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage.from('quote-files').upload(storagePath, file);
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from('quote_files').insert([
          {
            quote_batch_supplier_id: quoteBatchSupplierId,
            storage_path: storagePath,
            uploaded_by: user.id,
            uploaded_by_name: displayName,
          },
        ]);
        if (insertError) {
          // Sem isso, um insert que falhou (RLS, rede) deixava o objeto já
          // enviado ao Storage órfão pra sempre — nenhuma cascade do banco
          // alcança storage.objects, e sem uma linha em quote_files
          // apontando pra ele, nada no app nunca mais o encontra. Melhor
          // esforço: tenta remover antes de propagar o erro original.
          const { error: cleanupError } = await supabase.storage.from('quote-files').remove([storagePath]);
          if (cleanupError) {
            console.error(`Falha ao limpar objeto órfão ${storagePath} após erro de insert:`, cleanupError);
          }
          throw insertError;
        }
      }

      toast({ title: 'Arquivo(s) enviado(s)' });
      await fetchData();
    } catch (error) {
      console.error('Error uploading quote file:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível enviar um ou mais arquivos.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const reprocessFile = async (fileId: string) => {
    try {
      const { error } = await supabase.from('quote_files').update({ processed_at: null }).eq('id', fileId);
      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error resetting quote file for reprocessing:', error);
      toast({ title: 'Erro', description: 'Não foi possível marcar o arquivo pra reprocessar.', variant: 'destructive' });
    }
  };

  const runExtraction = async () => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-quote-prices', {
        body: { quoteBatchSupplierId },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error, 'Não foi possível extrair os preços.');
        toast({ title: 'Erro na extração', description: message, variant: 'destructive' });
        return;
      }
      const skippedNote =
        data.filesSkipped > 0 ? ` ${data.filesSkipped} arquivo(s) não pôde(puderam) ser lido(s).` : '';
      toast({
        title: 'Extração concluída',
        description: `A IA encontrou preço pra ${data.matched} de ${data.totalItems} item(ns).${skippedNote}`,
      });
      await fetchData();
    } catch (error) {
      console.error('Error running quote extraction:', error);
      toast({ title: 'Erro na extração', description: 'Não foi possível extrair os preços.', variant: 'destructive' });
    } finally {
      setExtracting(false);
    }
  };

  const updatePrice = async (quoteBatchItemId: string, price: number | null) => {
    if (!user || !displayName) return;
    try {
      const { data, error } = await supabase
        .from('quote_line_items')
        .update({ price, updated_by: user.id, updated_by_name: displayName })
        .eq('quote_batch_supplier_id', quoteBatchSupplierId)
        .eq('quote_batch_item_id', quoteBatchItemId)
        .select('id');
      if (error) throw error;
      // Um UPDATE que não acha nenhuma linha retorna error: null — sem essa
      // checagem, um lote com quote_line_items faltando (insert parcial na
      // criação, já um risco aceito) fazia o preço "salvar com sucesso" e
      // sumir, sem nenhum aviso.
      if (!data || data.length === 0) {
        throw new Error('Linha de preço não encontrada — este lote pode estar incompleto.');
      }
      setLineItems((prev) =>
        prev.map((li) =>
          li.quote_batch_item_id === quoteBatchItemId ? { ...li, price, updated_by_name: displayName } : li
        )
      );
    } catch (error) {
      console.error('Error updating quote line item price:', error);
      toast({ title: 'Erro ao salvar preço', description: 'Não foi possível salvar esse valor.', variant: 'destructive' });
    }
  };

  const updateNote = async (quoteBatchItemId: string, notes: string | null) => {
    if (!user || !displayName) return;
    try {
      const { data, error } = await supabase
        .from('quote_line_items')
        .update({ notes, updated_by: user.id, updated_by_name: displayName })
        .eq('quote_batch_supplier_id', quoteBatchSupplierId)
        .eq('quote_batch_item_id', quoteBatchItemId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Linha de preço não encontrada — este lote pode estar incompleto.');
      }
      setLineItems((prev) =>
        prev.map((li) => (li.quote_batch_item_id === quoteBatchItemId ? { ...li, notes } : li))
      );
    } catch (error) {
      console.error('Error updating quote line item note:', error);
      toast({ title: 'Erro ao salvar adendo', description: 'Não foi possível salvar essa observação.', variant: 'destructive' });
    }
  };

  const markReviewed = async () => {
    try {
      const { error } = await supabase.from('quote_batch_suppliers').update({ status: 'revisado' }).eq('id', quoteBatchSupplierId);
      if (error) throw error;
      toast({ title: 'Fornecedor marcado como revisado' });
    } catch (error) {
      console.error('Error marking quote batch supplier as reviewed:', error);
      toast({ title: 'Erro', description: 'Não foi possível marcar como revisado.', variant: 'destructive' });
      throw error;
    }
  };

  return {
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
    refetch: fetchData,
  };
};
