-- Restrict PIN column access at the column-privilege level
REVOKE SELECT (pin) ON public.attendance_employees FROM authenticated;
REVOKE SELECT (pin) ON public.attendance_employees FROM anon;

-- Remove permissive audit_log INSERT policy; only service_role may insert
DROP POLICY IF EXISTS "Authenticated users can insert audit log" ON public.audit_log;
