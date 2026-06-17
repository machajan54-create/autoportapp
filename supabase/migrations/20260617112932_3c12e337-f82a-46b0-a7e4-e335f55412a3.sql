-- Fix defects UPDATE WITH CHECK bug: previous self-join used defects_1.id = defects_1.id (always true → returned all rows)
DROP POLICY IF EXISTS defects_update ON public.defects;
CREATE POLICY defects_update
  ON public.defects
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR reported_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      reported_by = auth.uid()
      AND resolved_by IS NOT DISTINCT FROM (
        SELECT d.resolved_by FROM public.defects d WHERE d.id = defects.id
      )
      AND status IS NOT DISTINCT FROM (
        SELECT d.status FROM public.defects d WHERE d.id = defects.id
      )
    )
  );

-- vykup-photos storage: scope writes/updates/deletes to owner/assignee of the vykup (by id in first path segment)
DROP POLICY IF EXISTS vykup_photos_storage_insert ON storage.objects;
DROP POLICY IF EXISTS vykup_photos_storage_update ON storage.objects;
DROP POLICY IF EXISTS vykup_photos_storage_delete ON storage.objects;

CREATE POLICY vykup_photos_storage_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vykup-photos'
    AND public.has_module(auth.uid(), 'vykupy'::app_module)
    AND EXISTS (
      SELECT 1 FROM public.vykupy v
      WHERE v.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR v.created_by = auth.uid()
          OR v.assignee_id = auth.uid()
        )
    )
  );

CREATE POLICY vykup_photos_storage_update
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vykup-photos'
    AND EXISTS (
      SELECT 1 FROM public.vykupy v
      WHERE v.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR v.created_by = auth.uid()
          OR v.assignee_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    bucket_id = 'vykup-photos'
    AND EXISTS (
      SELECT 1 FROM public.vykupy v
      WHERE v.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR v.created_by = auth.uid()
          OR v.assignee_id = auth.uid()
        )
    )
  );

CREATE POLICY vykup_photos_storage_delete
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vykup-photos'
    AND EXISTS (
      SELECT 1 FROM public.vykupy v
      WHERE v.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR v.created_by = auth.uid()
          OR v.assignee_id = auth.uid()
        )
    )
  );
