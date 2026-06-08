-- Drop the unsafe policy
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- Recreate with WITH CHECK that prevents users from changing `approved`
CREATE POLICY profiles_update_own
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND approved = (SELECT approved FROM public.profiles WHERE id = auth.uid())
);

-- Allow admins to update any profile (including approved flag)
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));