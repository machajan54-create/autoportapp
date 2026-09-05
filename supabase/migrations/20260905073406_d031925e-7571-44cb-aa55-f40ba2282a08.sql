-- 1) TV content: writes admin-only
DROP POLICY IF EXISTS "slides_auth_write" ON public.slides;
CREATE POLICY "slides_admin_write" ON public.slides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "display_config_auth_write" ON public.display_config;
CREATE POLICY "display_config_admin_write" ON public.display_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "display_news anon write" ON public.display_news;
DROP POLICY IF EXISTS "display_news authenticated write" ON public.display_news;
DROP POLICY IF EXISTS "display_news_auth_write" ON public.display_news;
CREATE POLICY "display_news_admin_write" ON public.display_news
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) vykupy: authenticated-only + WITH CHECK on UPDATE
DROP POLICY IF EXISTS "vykupy_select" ON public.vykupy;
CREATE POLICY "vykupy_select" ON public.vykupy
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_module(auth.uid(), 'vykupy')
    OR created_by = auth.uid()
    OR assignee_id = auth.uid()
  );

DROP POLICY IF EXISTS "vykupy_update" ON public.vykupy;
CREATE POLICY "vykupy_update" ON public.vykupy
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_module(auth.uid(), 'vykupy')
    OR created_by = auth.uid()
    OR assignee_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_module(auth.uid(), 'vykupy')
    OR created_by = auth.uid()
    OR assignee_id = auth.uid()
  );

-- 3) vykup_photos: WITH CHECK on UPDATE (cannot move photo to another vykup)
DROP POLICY IF EXISTS "vykup_photos_update" ON public.vykup_photos;
CREATE POLICY "vykup_photos_update" ON public.vykup_photos
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vykupy v
    WHERE v.id = vykup_photos.vykup_id
      AND (public.has_role(auth.uid(), 'admin') OR v.created_by = auth.uid() OR v.assignee_id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.vykupy v
    WHERE v.id = vykup_photos.vykup_id
      AND (public.has_role(auth.uid(), 'admin') OR v.created_by = auth.uid() OR v.assignee_id = auth.uid())
  ));

-- 4) storage: slides bucket writes admin-only, reads unchanged
DROP POLICY IF EXISTS "slides_bucket_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "slides_bucket_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "slides_bucket_auth_delete" ON storage.objects;

CREATE POLICY "slides_bucket_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'slides' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "slides_bucket_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'slides' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'slides' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "slides_bucket_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'slides' AND public.has_role(auth.uid(), 'admin'));