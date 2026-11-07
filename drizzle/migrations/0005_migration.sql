DROP POLICY IF EXISTS "slides_auth_read_all" ON public.slides;
DROP POLICY IF EXISTS "display_config_auth_read" ON public.display_config;
DROP POLICY IF EXISTS "display_config_public_read" ON public.display_config;
DROP POLICY IF EXISTS "display_news authenticated read" ON public.display_news;
DROP POLICY IF EXISTS "slides_bucket_anon_read" ON storage.objects;
DROP POLICY IF EXISTS "slides_bucket_auth_read" ON storage.objects;
CREATE POLICY "slides_bucket_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'slides' AND public.has_role(auth.uid(), 'admin'));