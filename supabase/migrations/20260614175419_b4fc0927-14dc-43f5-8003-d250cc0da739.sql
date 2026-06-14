
ALTER TABLE public.logbook_entries ADD COLUMN IF NOT EXISTS receipt_path text;

-- RLS on storage.objects for the logbook-receipts bucket
CREATE POLICY "logbook receipts: users with module can read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'logbook-receipts'
  AND public.has_module(auth.uid(), 'logbook')
);

CREATE POLICY "logbook receipts: users with module can insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logbook-receipts'
  AND public.has_module(auth.uid(), 'logbook')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "logbook receipts: users with module can delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logbook-receipts'
  AND public.has_module(auth.uid(), 'logbook')
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
);
