-- Add display_order column to products table for custom sorting
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Update existing products with initial display_order based on created_at
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY line_type ORDER BY created_at) as rn
  FROM products
)
UPDATE products 
SET display_order = numbered.rn
FROM numbered
WHERE products.id = numbered.id;