ALTER TABLE public.display_config
  ADD COLUMN IF NOT EXISTS show_buyout boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS buyout_duration_sec integer NOT NULL DEFAULT 14;