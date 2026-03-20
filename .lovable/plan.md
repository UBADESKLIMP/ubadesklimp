

## Reduzir Bandwidth: Remover URLs de Imagens Pesadas do Banco

### Estratégia
Criar uma tabela de backup com todas as URLs de imagens e depois limpar (null) os campos `image_url` dos produtos mais pesados. Assim, quando o bandwidth resetar em abril, essas imagens não serão mais servidas.

### Passo 1: Criar tabela de backup via migration
```sql
CREATE TABLE public.image_urls_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Backup de TODAS as URLs de imagens (produtos, variações, fragrâncias)
INSERT INTO image_urls_backup (source_table, source_id, image_url)
SELECT 'products', id, image_url FROM products WHERE image_url IS NOT NULL;

INSERT INTO image_urls_backup (source_table, source_id, image_url)
SELECT 'product_variations', id, image_url FROM product_variations WHERE image_url IS NOT NULL;

INSERT INTO image_urls_backup (source_table, source_id, image_url)
SELECT 'product_fragrances', id, image_url FROM product_fragrances WHERE image_url IS NOT NULL;
```

### Passo 2: Limpar URLs dos produtos mais pesados via migration
```sql
-- Limpar fragrâncias do Coala (25 imagens) e Casa Perfume (6 imagens)
UPDATE product_fragrances SET image_url = NULL
WHERE product_id IN (
  SELECT id FROM products WHERE name ILIKE '%coala%' OR name ILIKE '%casa perfume%'
);

-- Limpar imagem principal desses produtos
UPDATE products SET image_url = NULL
WHERE name ILIKE '%coala%' OR name ILIKE '%casa perfume%';

-- Limpar variações dos automotivos mais pesados (Blend, Sintra, etc)
UPDATE product_variations SET image_url = NULL
WHERE product_id IN (
  SELECT id FROM products WHERE line_type = 'automotivo'
);

-- Limpar imagem principal dos automotivos
UPDATE products SET image_url = NULL WHERE line_type = 'automotivo';
```

### Resultado esperado
- ~80+ URLs de imagens removidas do banco
- Site mostrará produtos sem foto temporariamente (placeholder)
- Quando bandwidth resetar em abril: executar cleanup-storage, depois re-upload via admin (Cloudinary)
- Tabela `image_urls_backup` preserva todas as URLs originais caso precise consultar

### Risco
Se o Supabase bloquear também as migrations (não apenas storage), nada disso funcionará até abril. Mas vale tentar pois geralmente o bloqueio é apenas no storage/egress.

