

## Migrar Imagens do Supabase para Cloudinary

### Situação atual
- **25 produtos**, **20 variações** e **6 fragrâncias** ainda com URLs apontando para o Supabase Storage
- Cada acesso a essas imagens consome bandwidth do Supabase

### Plano: Edge Function de migração

Criar uma nova Edge Function `migrate-images-to-cloudinary` que:

1. Busca todos os registros com `image_url LIKE '%supabase%'` nas 3 tabelas
2. Para cada imagem: faz download do Supabase Storage e upload para o Cloudinary via API REST
3. Atualiza o `image_url` no banco com a nova URL do Cloudinary
4. Processa em lotes pequenos para não estourar o tempo de execução

### Detalhes técnicos

- **Cloud name**: `dclgv77ji` / **Upload preset**: `ubadesklimp` (já configurados no frontend)
- O Cloudinary aceita upload via URL direta (`url` param no upload), evitando download + re-upload — mais rápido e eficiente
- A Edge Function usará `SUPABASE_SERVICE_ROLE_KEY` para acessar o banco e atualizar URLs
- Processará as 3 tabelas sequencialmente: products → product_variations → product_fragrances
- Timeout safety: processa no máximo 20 imagens por execução; o frontend pode chamar múltiplas vezes

### Arquivo criado/modificado
- `supabase/functions/migrate-images-to-cloudinary/index.ts` (novo)

### Como usar
Após deploy, chamar a função pelo admin ou console. Pode ser necessário executar 3x (51 imagens / 20 por vez).

