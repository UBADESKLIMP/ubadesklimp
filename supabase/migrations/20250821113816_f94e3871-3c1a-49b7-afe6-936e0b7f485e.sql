-- Enable Row Level Security on categories table
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for categories table
-- Admins can manage all categories
CREATE POLICY "Admins can manage categories" ON public.categories
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can read categories (needed for product creation)
CREATE POLICY "Everyone can read categories" ON public.categories
FOR SELECT USING (true);

-- Add trigger for automatic timestamp updates on categories
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();