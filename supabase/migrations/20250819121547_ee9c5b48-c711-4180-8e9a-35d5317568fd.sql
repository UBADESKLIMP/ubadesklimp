-- Inserir usuário admin inicial
-- Substitua 'seu-email@exemplo.com' pelo email que você usará para fazer login
-- Este script criará o usuário admin após o primeiro login

-- Criar função para promover usuário a admin automaticamente
CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Se não há nenhum usuário admin ainda, promover este usuário
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para promover primeiro usuário
CREATE TRIGGER auto_promote_first_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_first_user_to_admin();