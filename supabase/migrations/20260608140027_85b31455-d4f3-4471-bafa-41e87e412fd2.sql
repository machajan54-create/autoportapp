-- Add new modules
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'approvals';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'dashboard';

-- Suppliers: allow authenticated to insert their own pending requests, see own; admin sees all
DROP POLICY IF EXISTS suppliers_all_admin ON public.suppliers;

CREATE POLICY suppliers_select_own_or_admin
ON public.suppliers
FOR SELECT
TO authenticated
USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY suppliers_insert_self
ON public.suppliers
FOR INSERT
TO authenticated
WITH CHECK (requested_by = auth.uid() AND status = 'pending');

CREATE POLICY suppliers_update_admin
ON public.suppliers
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY suppliers_delete_admin
ON public.suppliers
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Purchases: same model
DROP POLICY IF EXISTS purchases_all_admin ON public.purchases;

CREATE POLICY purchases_select_own_or_admin
ON public.purchases
FOR SELECT
TO authenticated
USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY purchases_insert_self
ON public.purchases
FOR INSERT
TO authenticated
WITH CHECK (requested_by = auth.uid() AND status = 'pending');

CREATE POLICY purchases_update_admin
ON public.purchases
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY purchases_delete_admin
ON public.purchases
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));