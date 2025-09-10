-- Criar tabela para fragrâncias dos produtos
CREATE TABLE public.product_fragrances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  available_literages text[] DEFAULT '{}',
  order_index integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.product_fragrances ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Everyone can read product_fragrances" 
ON public.product_fragrances 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage product_fragrances" 
ON public.product_fragrances 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Criar trigger para updated_at
CREATE TRIGGER update_product_fragrances_updated_at
BEFORE UPDATE ON public.product_fragrances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campo has_fragrances na tabela products se não existir
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS has_fragrances boolean DEFAULT false;