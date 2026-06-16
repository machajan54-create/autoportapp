-- RLS policies for attendance-reports bucket
CREATE POLICY "attendance_reports_admin_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'attendance-reports' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'attendance-reports' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "attendance_reports_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'attendance-reports'
  AND EXISTS (
    SELECT 1 FROM public.attendance_employees ae
    WHERE ae.user_id = auth.uid()
      AND (storage.foldername(name))[1] = ae.id::text
  )
);