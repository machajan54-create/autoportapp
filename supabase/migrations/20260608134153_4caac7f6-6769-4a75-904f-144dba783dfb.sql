
-- Helper functions: lock down search_path
CREATE OR REPLACE FUNCTION public.touch_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.assign_pu_number()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  IF NEW.pu_number IS NULL THEN
    NEW.pu_number := 'PU-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('public.claims_pu_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.log_claim_created()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.claim_events (claim_id, type, message)
  VALUES (NEW.id, 'created', 'Zakázka vytvořena klientem přes veřejný formulář');
  RETURN NEW;
END $$;

-- ============ claims ============
DROP POLICY IF EXISTS "claims_select_auth" ON public.claims;
DROP POLICY IF EXISTS "claims_update_auth" ON public.claims;

CREATE POLICY "claims_select_module" ON public.claims
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'claims'));

CREATE POLICY "claims_update_module" ON public.claims
  FOR UPDATE TO authenticated
  USING (public.has_module(auth.uid(), 'claims'))
  WITH CHECK (public.has_module(auth.uid(), 'claims'));

CREATE POLICY "claims_delete_admin" ON public.claims
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ claim_attachments ============
DROP POLICY IF EXISTS "attach_select_auth" ON public.claim_attachments;

CREATE POLICY "attach_select_module" ON public.claim_attachments
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'claims'));

CREATE POLICY "attach_delete_module" ON public.claim_attachments
  FOR DELETE TO authenticated
  USING (public.has_module(auth.uid(), 'claims'));

-- ============ claim_events ============
DROP POLICY IF EXISTS "events_select_auth" ON public.claim_events;
DROP POLICY IF EXISTS "events_insert_any" ON public.claim_events;

CREATE POLICY "events_select_module" ON public.claim_events
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'claims'));

CREATE POLICY "events_insert_module" ON public.claim_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), 'claims'));

-- ============ claim_tasks ============
DROP POLICY IF EXISTS "tasks_all_auth" ON public.claim_tasks;

CREATE POLICY "tasks_select_module" ON public.claim_tasks
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'claims'));

CREATE POLICY "tasks_insert_module" ON public.claim_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), 'claims'));

CREATE POLICY "tasks_update_module" ON public.claim_tasks
  FOR UPDATE TO authenticated
  USING (public.has_module(auth.uid(), 'claims'))
  WITH CHECK (public.has_module(auth.uid(), 'claims'));

CREATE POLICY "tasks_delete_module" ON public.claim_tasks
  FOR DELETE TO authenticated
  USING (public.has_module(auth.uid(), 'claims'));

-- ============ profiles ============
DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- ============ user_roles ============
DROP POLICY IF EXISTS "user_roles_select_auth" ON public.user_roles;

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ vykupy ============
DROP POLICY IF EXISTS "vykupy_all_auth" ON public.vykupy;

CREATE POLICY "vykupy_select_module" ON public.vykupy
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'vykupy'));

CREATE POLICY "vykupy_insert_module" ON public.vykupy
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), 'vykupy'));

CREATE POLICY "vykupy_update_module" ON public.vykupy
  FOR UPDATE TO authenticated
  USING (public.has_module(auth.uid(), 'vykupy'))
  WITH CHECK (public.has_module(auth.uid(), 'vykupy'));

CREATE POLICY "vykupy_delete_module" ON public.vykupy
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ storage.objects: claim-files ============
DROP POLICY IF EXISTS "claim_files_read_auth" ON storage.objects;

CREATE POLICY "claim_files_read_module" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'claim-files' AND public.has_module(auth.uid(), 'claims'));
