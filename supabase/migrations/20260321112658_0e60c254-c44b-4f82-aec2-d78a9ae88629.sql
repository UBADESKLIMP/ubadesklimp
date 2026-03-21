ALTER TABLE public.image_urls_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access backup"
ON public.image_urls_backup
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));