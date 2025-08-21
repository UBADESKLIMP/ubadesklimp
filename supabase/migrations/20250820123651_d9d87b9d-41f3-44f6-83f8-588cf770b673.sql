
-- Criar tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Inserir categorias padrão
INSERT INTO categories (name) VALUES 
  ('Detergentes'),
  ('Desinfetantes'),
  ('Kits'),
  ('Sabões'),
  ('Especiais'),
  ('Higiene')
ON CONFLICT (name) DO NOTHING;

-- Adicionar constraint para garantir que category nos produtos existe em categories
-- Primeiro, vamos adicionar as categorias que já existem nos produtos
INSERT INTO categories (name) 
SELECT DISTINCT category 
FROM products 
WHERE category IS NOT NULL 
ON CONFLICT (name) DO NOTHING;
