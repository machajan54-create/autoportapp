DROP POLICY IF EXISTS vykupy_select ON public.vykupy;
DROP POLICY IF EXISTS vykupy_update ON public.vykupy;

CREATE POLICY vykupy_select ON public.vykupy
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_module(auth.uid(), 'vykupy')
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
);

CREATE POLICY vykupy_update ON public.vykupy
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_module(auth.uid(), 'vykupy')
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
);