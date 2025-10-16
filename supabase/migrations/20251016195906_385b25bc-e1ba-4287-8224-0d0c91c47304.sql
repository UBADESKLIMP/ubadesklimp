-- Adicionar coluna para controlar a posição do preço no card
ALTER TABLE public.products 
ADD COLUMN price_position text DEFAULT 'below_text' CHECK (price_position IN ('below_image', 'below_text'));