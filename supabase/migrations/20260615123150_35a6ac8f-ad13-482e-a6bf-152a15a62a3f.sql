
CREATE POLICY "auth read client-documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'client-documents');
CREATE POLICY "auth write client-documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-documents');
CREATE POLICY "auth update client-documents" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'client-documents');
CREATE POLICY "auth delete client-documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'client-documents');
