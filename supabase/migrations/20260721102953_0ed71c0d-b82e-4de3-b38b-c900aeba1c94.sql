
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND approved = (SELECT p.approved FROM public.profiles p WHERE p.id = auth.uid())
  AND is_department_head IS NOT DISTINCT FROM (SELECT p.is_department_head FROM public.profiles p WHERE p.id = auth.uid())
  AND department IS NOT DISTINCT FROM (SELECT p.department FROM public.profiles p WHERE p.id = auth.uid())
);
