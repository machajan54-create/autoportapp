-- Add 'tasks' to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'tasks';

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date date,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_name text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid() OR assignee_id = auth.uid());

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid() OR assignee_id = auth.uid());

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();