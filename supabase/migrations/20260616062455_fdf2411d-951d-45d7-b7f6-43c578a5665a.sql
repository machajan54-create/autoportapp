
-- 1) deals: DELETE only for admins
DROP POLICY IF EXISTS deals_delete ON public.deals;
CREATE POLICY deals_delete ON public.deals
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) defects: allow any module user to update (collaborative resolution)
DROP POLICY IF EXISTS defects_update_own_or_admin ON public.defects;
CREATE POLICY defects_update_module ON public.defects
  FOR UPDATE TO authenticated
  USING (public.has_module(auth.uid(), 'defects'))
  WITH CHECK (public.has_module(auth.uid(), 'defects'));

-- 3) storage: task-attachments INSERT must verify task membership
DROP POLICY IF EXISTS "task-attachments-insert" ON storage.objects;
CREATE POLICY "task-attachments-insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
      )
    )
  );
