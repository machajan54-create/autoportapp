
-- 1) Hide PIN column from clients by revoking column-level SELECT.
--    Server-side admin code uses supabaseAdmin (service_role), which retains access.
REVOKE SELECT (pin) ON public.attendance_employees FROM authenticated;
REVOKE SELECT (pin) ON public.attendance_employees FROM anon;
REVOKE UPDATE (pin) ON public.attendance_employees FROM authenticated;
REVOKE INSERT (pin) ON public.attendance_employees FROM authenticated;

-- 2) Allow users with 'claims' module to insert claim attachments.
CREATE POLICY "claims module can insert attachments"
ON public.claim_attachments
FOR INSERT
TO authenticated
WITH CHECK (public.has_module(auth.uid(), 'claims'));

-- 3) Allow users with 'claims' module to upload into 'claim-files' bucket.
CREATE POLICY "claims module can upload claim-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'claim-files'
  AND public.has_module(auth.uid(), 'claims')
);
