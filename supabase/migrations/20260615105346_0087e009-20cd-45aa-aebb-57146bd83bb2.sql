
-- 1) Vykup photos table
CREATE TABLE public.vykup_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vykup_id uuid NOT NULL REFERENCES public.vykupy(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint NOT NULL DEFAULT 0,
  has_defect boolean NOT NULL DEFAULT false,
  defect_note text,
  uploader_id uuid,
  uploader_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vykup_photos_vykup_idx ON public.vykup_photos(vykup_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vykup_photos TO authenticated;
GRANT ALL ON public.vykup_photos TO service_role;

ALTER TABLE public.vykup_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vykup_photos_select" ON public.vykup_photos FOR SELECT
  TO authenticated USING (public.has_module(auth.uid(), 'vykupy'));
CREATE POLICY "vykup_photos_insert" ON public.vykup_photos FOR INSERT
  TO authenticated WITH CHECK (public.has_module(auth.uid(), 'vykupy'));
CREATE POLICY "vykup_photos_update" ON public.vykup_photos FOR UPDATE
  TO authenticated USING (public.has_module(auth.uid(), 'vykupy'))
  WITH CHECK (public.has_module(auth.uid(), 'vykupy'));
CREATE POLICY "vykup_photos_delete" ON public.vykup_photos FOR DELETE
  TO authenticated USING (public.has_module(auth.uid(), 'vykupy'));

CREATE TRIGGER vykup_photos_touch_updated BEFORE UPDATE ON public.vykup_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Storage RLS for vykup-photos bucket
CREATE POLICY "vykup_photos_storage_select" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'vykup-photos' AND public.has_module(auth.uid(), 'vykupy')
  );
CREATE POLICY "vykup_photos_storage_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'vykup-photos' AND public.has_module(auth.uid(), 'vykupy')
  );
CREATE POLICY "vykup_photos_storage_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'vykup-photos' AND public.has_module(auth.uid(), 'vykupy')
  );

-- 3) Sledování doby ve stavu + follow-up pro vykupy
ALTER TABLE public.vykupy
  ADD COLUMN stav_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN follow_up_at timestamptz,
  ADD COLUMN follow_up_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.vykupy_track_stav_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stav_changed_at := COALESCE(NEW.stav_changed_at, now());
  ELSIF TG_OP = 'UPDATE' AND NEW.stav IS DISTINCT FROM OLD.stav THEN
    NEW.stav_changed_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER vykupy_track_stav BEFORE INSERT OR UPDATE ON public.vykupy
  FOR EACH ROW EXECUTE FUNCTION public.vykupy_track_stav_change();

-- 4) Sledování doby ve stavu + follow-up pro deals
ALTER TABLE public.deals
  ADD COLUMN stage_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN follow_up_at timestamptz,
  ADD COLUMN follow_up_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.deals_track_stage_change()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.stage_changed_at := COALESCE(NEW.stage_changed_at, now());
  ELSIF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER deals_track_stage BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_track_stage_change();

-- 5) pg_cron — follow-up reminders (každých 15 minut)
SELECT cron.schedule(
  'autoport-followup-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--citsunzrpbtobbzlkxlo.lovable.app/api/public/cron/followup-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_X76h7c2uHFVm7WHiklG0VA_PZY9-GeH'
    ),
    body := '{}'::jsonb
  );
  $$
);
