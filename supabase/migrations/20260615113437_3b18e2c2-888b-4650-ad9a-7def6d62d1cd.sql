
-- 1) Hide PIN column from authenticated/anon
REVOKE SELECT (pin) ON public.attendance_employees FROM PUBLIC;
REVOKE SELECT (pin) ON public.attendance_employees FROM anon;
REVOKE SELECT (pin) ON public.attendance_employees FROM authenticated;

-- 2) Tighten defect-photos read policy to module/admin
DROP POLICY IF EXISTS defect_photos_read ON storage.objects;
CREATE POLICY defect_photos_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'defect-photos'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_module(auth.uid(), 'defects'::app_module))
  );

-- 3) Set fixed search_path on email queue functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
