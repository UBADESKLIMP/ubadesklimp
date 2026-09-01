begin;

-- O bucket product-images foi criado pela migration original do site
-- (2025-08-19) e as policies de storage.objects que o referenciam continuam
-- de pé (recriadas em 20260805120000_staff_roles_permissions.sql), mas o
-- bucket em si não existe mais neste projeto — confirmado batendo direto no
-- endpoint de Storage (retorna "Bucket not found" tanto pra upload quanto
-- pra leitura pública). Sem o bucket, todo upload de foto de produto falhava
-- silenciosamente, o que empurrou o cadastro a depender só do Cloudinary —
-- e quando a conta Cloudinary estourou a cota, as fotos do site inteiro
-- sumiram. Recria de forma idempotente (on conflict) e já com limite de
-- tamanho/tipos, no mesmo padrão de defesa em profundidade usado em
-- 20260811130000_quote_files_bucket_limits.sql.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
