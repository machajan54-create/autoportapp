CREATE POLICY "task-attachments-read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-attachments' AND (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (
        SELECT 1 FROM public.task_attachments a
        JOIN public.tasks t ON t.id = a.task_id
        WHERE a.storage_path = name
          AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
      )
    )
  );

CREATE POLICY "task-attachments-insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "task-attachments-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-attachments' AND (
      public.has_role(auth.uid(),'admin')
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );