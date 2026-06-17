
-- Fix attendance_notifications: scope by recipient
DROP POLICY IF EXISTS "dochazka users access notifications" ON public.attendance_notifications;

CREATE POLICY "notifications_select_recipient"
ON public.attendance_notifications FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_for_manager = true AND has_module(auth.uid(), 'dochazka'::app_module))
  OR recipient_employee_id IN (SELECT id FROM public.attendance_employees WHERE user_id = auth.uid())
);

CREATE POLICY "notifications_update_recipient"
ON public.attendance_notifications FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_for_manager = true AND has_module(auth.uid(), 'dochazka'::app_module))
  OR recipient_employee_id IN (SELECT id FROM public.attendance_employees WHERE user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (is_for_manager = true AND has_module(auth.uid(), 'dochazka'::app_module))
  OR recipient_employee_id IN (SELECT id FROM public.attendance_employees WHERE user_id = auth.uid())
);

CREATE POLICY "notifications_insert_admin"
ON public.attendance_notifications FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "notifications_delete_admin"
ON public.attendance_notifications FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix defects: prevent privilege escalation via resolved_by self-assignment
DROP POLICY IF EXISTS defects_update ON public.defects;

CREATE POLICY defects_update
ON public.defects FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR reported_by = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (reported_by = auth.uid() AND resolved_by IS NOT DISTINCT FROM (SELECT resolved_by FROM public.defects WHERE id = defects.id)))
;
