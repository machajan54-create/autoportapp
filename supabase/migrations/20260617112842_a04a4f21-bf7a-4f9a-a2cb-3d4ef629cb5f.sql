-- Fix 1: deal_stage_history — scope SELECT to deal owner or admin
DROP POLICY IF EXISTS deal_stage_history_select ON public.deal_stage_history;
CREATE POLICY deal_stage_history_select
  ON public.deal_stage_history
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_stage_history.deal_id
        AND d.owner_id = auth.uid()
    )
  );

-- Fix 2: defects — require approved user for INSERT;
-- tighten SELECT so resolved_by alone doesn't unlock the row to a random user
DROP POLICY IF EXISTS defects_insert ON public.defects;
CREATE POLICY defects_insert
  ON public.defects
  FOR INSERT TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND public.is_approved_user(auth.uid())
  );

DROP POLICY IF EXISTS defects_select ON public.defects;
CREATE POLICY defects_select
  ON public.defects
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      public.is_approved_user(auth.uid())
      AND (reported_by = auth.uid() OR resolved_by = auth.uid())
    )
  );
