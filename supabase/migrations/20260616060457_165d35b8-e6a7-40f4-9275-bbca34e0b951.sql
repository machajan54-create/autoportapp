
-- 1) Defects: read only with module
DROP POLICY IF EXISTS "defects_select_authenticated" ON public.defects;
CREATE POLICY "defects_select_module"
  ON public.defects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_module(auth.uid(), 'defects'));

-- 2) Attendance settings: split read (module) vs write (admin)
DROP POLICY IF EXISTS "dochazka users access settings" ON public.attendance_settings;

CREATE POLICY "attendance_settings_select_module"
  ON public.attendance_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_module(auth.uid(), 'dochazka'));

CREATE POLICY "attendance_settings_insert_admin"
  ON public.attendance_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "attendance_settings_update_admin"
  ON public.attendance_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "attendance_settings_delete_admin"
  ON public.attendance_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
