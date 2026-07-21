
CREATE POLICY "slides_bucket_anon_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'slides');
