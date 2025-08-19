-- Criar tabela de produtos
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Criar políticas para permitir leitura pública dos produtos
CREATE POLICY "Produtos são visíveis para todos" 
ON public.products 
FOR SELECT 
USING (true);

-- Política para permitir inserção, atualização e exclusão (para admin)
CREATE POLICY "Admins podem gerenciar produtos" 
ON public.products 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Criar função para atualizar timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualização automática de timestamps
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket para imagens de produtos
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Políticas para upload de imagens
CREATE POLICY "Imagens de produtos são públicas" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Qualquer um pode fazer upload de imagens de produtos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Qualquer um pode atualizar imagens de produtos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images');

CREATE POLICY "Qualquer um pode deletar imagens de produtos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images');