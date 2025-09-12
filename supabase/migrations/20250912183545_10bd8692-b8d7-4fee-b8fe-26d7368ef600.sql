-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  name TEXT,
  phone TEXT,
  email TEXT,
  
  -- Person type
  person_type TEXT CHECK (person_type IN ('pf', 'pj')) DEFAULT 'pf',
  
  -- PF fields
  cpf TEXT,
  
  -- PJ fields
  company_name TEXT, -- Razão social
  trade_name TEXT,   -- Fantasia
  cnpj TEXT,
  state_registration TEXT, -- IE
  
  -- Common fields
  delivery_address TEXT,
  billing_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add trigger for timestamps
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();