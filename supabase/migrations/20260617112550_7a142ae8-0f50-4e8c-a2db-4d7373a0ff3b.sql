-- Replace overly broad ALL policy on attendance_employees with split policies:
-- SELECT: anyone with dochazka module (preserves employees reading their own user_id link)
-- INSERT/UPDATE/DELETE: admin only

DROP POLICY IF EXISTS "dochazka users access employees" ON public.attendance_employees;

CREATE POLICY "attendance_employees_select_module"
  ON public.attendance_employees
  FOR SELECT
  TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'::app_module));

CREATE POLICY "attendance_employees_insert_admin"
  ON public.attendance_employees
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "attendance_employees_update_admin"
  ON public.attendance_employees
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "attendance_employees_delete_admin"
  ON public.attendance_employees
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
