ALTER TABLE public.display_config
  ADD COLUMN IF NOT EXISTS feedback_duration_sec integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS lounge_duration_sec integer NOT NULL DEFAULT 12;