-- Adicionar campo para litragem única e status de estoque
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS literage_single text,
ADD COLUMN IF NOT EXISTS out_of_stock boolean DEFAULT false;