
-- Helper: check if a user is an approved member of the workspace
CREATE OR REPLACE FUNCTION public.is_approved_user(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND approved = true
  )
$$;

-- =========================
-- public.clients
-- =========================
DROP POLICY IF EXISTS "auth read clients" ON public.clients;
DROP POLICY IF EXISTS "auth insert clients" ON public.clients;
DROP POLICY IF EXISTS "auth update clients" ON public.clients;

CREATE POLICY "approved read clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_approved_user(auth.uid()));

CREATE POLICY "approved insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.is_approved_user(auth.uid()));

CREATE POLICY "approved update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.is_approved_user(auth.uid()))
  WITH CHECK (public.is_approved_user(auth.uid()));

-- =========================
-- public.demo_orders (module-gated)
-- =========================
DROP POLICY IF EXISTS "auth read orders" ON public.demo_orders;
DROP POLICY IF EXISTS "auth write orders" ON public.demo_orders;
DROP POLICY IF EXISTS "auth update orders" ON public.demo_orders;

CREATE POLICY "module read orders" ON public.demo_orders
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'demo_orders'::app_module));

CREATE POLICY "module insert orders" ON public.demo_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), 'demo_orders'::app_module));

CREATE POLICY "module update orders" ON public.demo_orders
  FOR UPDATE TO authenticated
  USING (public.has_module(auth.uid(), 'demo_orders'::app_module))
  WITH CHECK (public.has_module(auth.uid(), 'demo_orders'::app_module));

-- =========================
-- public.demo_order_documents
-- =========================
DROP POLICY IF EXISTS "auth read docs" ON public.demo_order_documents;
DROP POLICY IF EXISTS "auth insert docs" ON public.demo_order_documents;

CREATE POLICY "module read docs" ON public.demo_order_documents
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'demo_orders'::app_module));

CREATE POLICY "module insert docs" ON public.demo_order_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), 'demo_orders'::app_module));

-- =========================
-- public.demo_order_signatures (sensitive: IP, signature image)
-- =========================
DROP POLICY IF EXISTS "auth read sigs" ON public.demo_order_signatures;
DROP POLICY IF EXISTS "auth write sigs" ON public.demo_order_signatures;
DROP POLICY IF EXISTS "auth update sigs" ON public.demo_order_signatures;

CREATE POLICY "module read sigs" ON public.demo_order_signatures
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'demo_orders'::app_module));

-- Public signing flow inserts with anon (token-based); keep permissive but require row token presence
CREATE POLICY "auth write sigs" ON public.demo_order_signatures
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), 'demo_orders'::app_module));

CREATE POLICY "module update sigs" ON public.demo_order_signatures
  FOR UPDATE TO authenticated
  USING (public.has_module(auth.uid(), 'demo_orders'::app_module))
  WITH CHECK (public.has_module(auth.uid(), 'demo_orders'::app_module));

-- =========================
-- storage: client-documents bucket - restrict to approved users
-- =========================
DROP POLICY IF EXISTS "auth read client-documents" ON storage.objects;
DROP POLICY IF EXISTS "auth write client-documents" ON storage.objects;
DROP POLICY IF EXISTS "auth update client-documents" ON storage.objects;
DROP POLICY IF EXISTS "auth delete client-documents" ON storage.objects;

CREATE POLICY "approved read client-documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_approved_user(auth.uid()));

CREATE POLICY "approved write client-documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-documents' AND public.is_approved_user(auth.uid()));

CREATE POLICY "approved update client-documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_approved_user(auth.uid()))
  WITH CHECK (bucket_id = 'client-documents' AND public.is_approved_user(auth.uid()));

CREATE POLICY "approved delete client-documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-documents' AND public.is_approved_user(auth.uid()));

-- =========================
-- storage: vykup-photos UPDATE policy (add for consistency)
-- =========================
DROP POLICY IF EXISTS "vykup_photos_storage_update" ON storage.objects;
CREATE POLICY "vykup_photos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'vykup-photos' AND public.has_module(auth.uid(), 'vykupy'::app_module))
  WITH CHECK (bucket_id = 'vykup-photos' AND public.has_module(auth.uid(), 'vykupy'::app_module));
