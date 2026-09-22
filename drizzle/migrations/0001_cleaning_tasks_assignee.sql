ALTER TABLE public.cleaning_tasks
  ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assignee_name text;

CREATE INDEX IF NOT EXISTS cleaning_tasks_assignee_id_idx ON public.cleaning_tasks (assignee_id);