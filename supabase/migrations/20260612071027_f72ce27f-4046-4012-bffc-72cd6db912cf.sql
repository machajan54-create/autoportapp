
-- Drop the over-permissive anon INSERT policy
DROP POLICY IF EXISTS "claim_files_upload_anyone" ON storage.objects;

-- Add admin-only UPDATE and DELETE policies on claim-files bucket
DROP POLICY IF EXISTS "claim_files_update_admin" ON storage.objects;
CREATE POLICY "claim_files_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'claim-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'claim-files' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "claim_files_delete_admin" ON storage.objects;
CREATE POLICY "claim_files_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'claim-files' AND public.has_role(auth.uid(), 'admin'));
