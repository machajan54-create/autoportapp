REVOKE SELECT (pin) ON public.attendance_employees FROM authenticated, anon;
REVOKE UPDATE (pin), INSERT (pin) ON public.attendance_employees FROM authenticated, anon;