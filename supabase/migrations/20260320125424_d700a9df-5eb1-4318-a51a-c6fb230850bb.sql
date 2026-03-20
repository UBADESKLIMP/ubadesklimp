-- Passo 1: Criar tabela de backup e salvar todas as URLs
CREATE TABLE public.image_urls_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO image_urls_backup (source_table, source_id, image_url)
SELECT 'products', id, image_url FROM products WHERE image_url IS NOT NULL;

INSERT INTO image_urls_backup (source_table, source_id, image_url)
SELECT 'product_variations', id, image_url FROM product_variations WHERE image_url IS NOT NULL;

INSERT INTO image_urls_backup (source_table, source_id, image_url)
SELECT 'product_fragrances', id, image_url FROM product_fragrances WHERE image_url IS NOT NULL;

-- Passo 2: Limpar URLs dos produtos mais pesados
UPDATE product_fragrances SET image_url = NULL
WHERE product_id IN (
  SELECT id FROM products WHERE name ILIKE '%coala%' OR name ILIKE '%casa perfume%'
);

UPDATE products SET image_url = NULL
WHERE name ILIKE '%coala%' OR name ILIKE '%casa perfume%';

UPDATE product_variations SET image_url = NULL
WHERE product_id IN (
  SELECT id FROM products WHERE line_type = 'automotivo'
);

UPDATE products SET image_url = NULL WHERE line_type = 'automotivo';