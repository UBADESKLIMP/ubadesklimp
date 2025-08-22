
-- Criar tabela para variações de produtos
CREATE TABLE public.product_variations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  literage TEXT NOT NULL,
  price NUMERIC NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar RLS para variações de produtos
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;

-- Política para admins gerenciarem variações
CREATE POLICY "Admins podem gerenciar variações de produtos" 
  ON public.product_variations 
  FOR ALL 
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Política para todos lerem variações
CREATE POLICY "Variações são visíveis para todos" 
  ON public.product_variations 
  FOR SELECT 
  USING (true);

-- Adicionar campos ao produto para controlar variações
ALTER TABLE public.products 
ADD COLUMN has_variations BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN material TEXT,
ADD COLUMN validity TEXT,
ADD COLUMN specifications TEXT,
ADD COLUMN priority_order INTEGER DEFAULT 0;

-- Trigger para atualizar updated_at em variações
CREATE TRIGGER update_product_variations_updated_at
  BEFORE UPDATE ON public.product_variations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Criar índice para melhor performance
CREATE INDEX idx_product_variations_product_id ON public.product_variations(product_id);
CREATE INDEX idx_products_priority ON public.products(priority, priority_order, created_at);
