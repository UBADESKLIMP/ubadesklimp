-- Adicionar coluna line_type para separar linhas de produtos
ALTER TABLE products ADD COLUMN IF NOT EXISTS line_type TEXT DEFAULT 'limpeza';

-- Migrar dados existentes: produtos com category contendo 'automotivo' vão para line_type='automotivo'
UPDATE products SET line_type = 'automotivo' WHERE LOWER(category) LIKE '%automotivo%' OR LOWER(category) = 'automotivo';