ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS last_activity_by uuid,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tasks_last_activity_at ON public.tasks(last_activity_at);