
-- Add priority column to products table
ALTER TABLE public.products 
ADD COLUMN priority BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for better performance when ordering by priority
CREATE INDEX idx_products_priority ON public.products(priority DESC, created_at DESC);
