CREATE POLICY "defect_photos_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'defect-photos');

CREATE POLICY "defect_photos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'defect-photos' AND owner = auth.uid());

CREATE POLICY "defect_photos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'defect-photos' AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin')));