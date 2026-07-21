
-- SLIDES
CREATE TABLE public.slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  subtitle text,
  body text,
  image_url text,
  type text NOT NULL DEFAULT 'news' CHECK (type IN ('news','promo','vehicle','video')),
  duration_sec integer NOT NULL DEFAULT 12 CHECK (duration_sec BETWEEN 3 AND 600),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.slides TO authenticated;
GRANT ALL ON public.slides TO service_role;
ALTER TABLE public.slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slides_public_read_active" ON public.slides
  FOR SELECT TO anon
  USING (
    active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_to   IS NULL OR valid_to   >= now())
  );
CREATE POLICY "slides_auth_read_all" ON public.slides
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "slides_auth_write" ON public.slides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_slides_updated_at
  BEFORE UPDATE ON public.slides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- DISPLAY CONFIG
CREATE TABLE public.display_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  ticker_text text,
  show_weather boolean NOT NULL DEFAULT false,
  show_clock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.display_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_config TO authenticated;
GRANT ALL ON public.display_config TO service_role;
ALTER TABLE public.display_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "display_config_public_read" ON public.display_config
  FOR SELECT TO anon USING (true);
CREATE POLICY "display_config_auth_read" ON public.display_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "display_config_auth_write" ON public.display_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_display_config_updated_at
  BEFORE UPDATE ON public.display_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime on slides
ALTER PUBLICATION supabase_realtime ADD TABLE public.slides;
ALTER PUBLICATION supabase_realtime ADD TABLE public.display_config;

-- Storage policies for 'slides' bucket
CREATE POLICY "slides_bucket_auth_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'slides');
CREATE POLICY "slides_bucket_auth_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'slides');
CREATE POLICY "slides_bucket_auth_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'slides');
CREATE POLICY "slides_bucket_auth_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'slides');
-- Anonymous read via signed URL only; no public policy needed.

-- Seed a default display config
INSERT INTO public.display_config (name, token, ticker_text, show_clock)
VALUES ('Showroom', encode(gen_random_bytes(12), 'hex'), 'Vítejte v Autoport showroomu · autoport-app.cz', true);
