DROP POLICY IF EXISTS suppliers_insert_self ON public.suppliers;
CREATE POLICY suppliers_insert_self ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'::approval_status
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
);

DROP POLICY IF EXISTS purchases_insert_self ON public.purchases;
CREATE POLICY purchases_insert_self ON public.purchases FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'::approval_status
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND approved = true)
);