
-- Extend slides with rich types and widget payloads
ALTER TABLE public.slides
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS transition text NOT NULL DEFAULT 'fade',
  ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 1;

-- Drop old check if any and add new
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'slides_kind_check') THEN
    ALTER TABLE public.slides DROP CONSTRAINT slides_kind_check;
  END IF;
END$$;

ALTER TABLE public.slides
  ADD CONSTRAINT slides_kind_check
    CHECK (kind IN ('image','video','youtube','rich_text','web_url','data_widget'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'slides_transition_check') THEN
    ALTER TABLE public.slides DROP CONSTRAINT slides_transition_check;
  END IF;
END$$;

ALTER TABLE public.slides
  ADD CONSTRAINT slides_transition_check
    CHECK (transition IN ('fade','slide','kenburns','none'));

-- Display news feed
CREATE TABLE IF NOT EXISTS public.display_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.display_news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.display_news TO authenticated;
GRANT ALL ON public.display_news TO service_role;

ALTER TABLE public.display_news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "display_news anon read active" ON public.display_news;
CREATE POLICY "display_news anon read active" ON public.display_news
  FOR SELECT TO anon
  USING (
    active = true
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_to IS NULL OR valid_to >= now())
  );

DROP POLICY IF EXISTS "display_news authenticated read" ON public.display_news;
CREATE POLICY "display_news authenticated read" ON public.display_news
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "display_news admin write" ON public.display_news;
CREATE POLICY "display_news admin write" ON public.display_news
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_display_news_touch ON public.display_news;
CREATE TRIGGER trg_display_news_touch
  BEFORE UPDATE ON public.display_news
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime for the news feed so TV pushes update instantly
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.display_news;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;
