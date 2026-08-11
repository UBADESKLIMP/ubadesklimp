begin;

-- Defesa em profundidade: a validação de tipo/tamanho hoje só existe no
-- client (useQuoteSupplierReview.ts). Sem um limite no próprio bucket,
-- qualquer staff com token consegue subir direto pro Storage, ignorando
-- o client. Mesmos 15MB e tipos aceitos já usados no client.
update storage.buckets
set file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
where id = 'quote-files';

commit;
