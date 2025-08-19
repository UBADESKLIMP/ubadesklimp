-- Criar enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Criar tabela de roles de usuário
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Habilitar RLS na tabela user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Criar função security definer para verificar roles (evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Política para user_roles - usuários podem ver apenas seus próprios roles
CREATE POLICY "Usuários podem ver seus próprios roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Apenas admins podem gerenciar roles
CREATE POLICY "Admins podem gerenciar roles" 
ON public.user_roles 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- CORRIGIR POLÍTICA DE SEGURANÇA CRÍTICA
-- Remover política insegura atual
DROP POLICY IF EXISTS "Admins podem gerenciar produtos" ON public.products;

-- Criar política segura para admins autenticados
CREATE POLICY "Apenas admins autenticados podem gerenciar produtos" 
ON public.products 
FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Políticas de storage também precisam ser seguras
DROP POLICY IF EXISTS "Qualquer um pode fazer upload de imagens de produtos" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode atualizar imagens de produtos" ON storage.objects;
DROP POLICY IF EXISTS "Qualquer um pode deletar imagens de produtos" ON storage.objects;

-- Políticas seguras para storage
CREATE POLICY "Admins podem fazer upload de imagens de produtos" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar imagens de produtos" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar imagens de produtos" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- Inserir primeiro usuário admin (substitua pelo seu email)
-- Comentado para evitar erro se não houver usuários
-- INSERT INTO public.user_roles (user_id, role) 
-- SELECT id, 'admin' FROM auth.users WHERE email = 'seu-email@exemplo.com' LIMIT 1;