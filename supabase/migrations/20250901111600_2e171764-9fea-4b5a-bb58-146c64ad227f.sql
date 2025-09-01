
-- Adicionar os campos adicionais na tabela products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS priority_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_variations BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS validity TEXT,
ADD COLUMN IF NOT EXISTS specifications TEXT;

-- Criar tabela para variações de produtos
CREATE TABLE IF NOT EXISTS product_variations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  literage TEXT NOT NULL,
  price NUMERIC NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar trigger para updated_at na tabela product_variations
CREATE TRIGGER update_product_variations_updated_at
  BEFORE UPDATE ON product_variations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS para product_variations
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read product variations" ON product_variations
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage product variations" ON product_variations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
