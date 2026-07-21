ALTER TABLE public.display_config
  ADD COLUMN IF NOT EXISTS show_feedback boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_lounge boolean NOT NULL DEFAULT true;