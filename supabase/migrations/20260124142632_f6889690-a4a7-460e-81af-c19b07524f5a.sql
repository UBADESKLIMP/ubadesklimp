-- Adicionar coluna brand na tabela products
ALTER TABLE products 
ADD COLUMN brand text;

-- Tentar popular marcas baseado no nome dos produtos existentes
UPDATE products 
SET brand = 'Vonixx' 
WHERE (name ILIKE '%Vonixx%' OR description ILIKE '%Vonixx%') 
AND line_type = 'automotivo';

UPDATE products 
SET brand = 'Vintex' 
WHERE (name ILIKE '%Vintex%' OR description ILIKE '%Vintex%') 
AND line_type = 'automotivo'
AND brand IS NULL;