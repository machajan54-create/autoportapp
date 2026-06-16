-- Fix broken attendance reports SELECT policy
DROP POLICY IF EXISTS attendance_reports_select_own ON storage.objects;

CREATE POLICY attendance_reports_select_own ON storage.objects
FOR SELECT
USING (
  bucket_id = 'attendance-reports'
  AND EXISTS (
    SELECT 1 FROM public.attendance_employees ae
    WHERE ae.user_id = auth.uid()
      AND (storage.foldername(storage.objects.name))[1] = ae.id::text
  )
);

-- Add missing UPDATE policy on defect-photos (mirrors delete: owner or admin)
DROP POLICY IF EXISTS defect_photos_update ON storage.objects;

CREATE POLICY defect_photos_update ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'defect-photos'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
)
WITH CHECK (
  bucket_id = 'defect-photos'
  AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
);