-- 1. Tasks: nové sloupce
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_until DATE,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_recurrence_at DATE,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMPTZ;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_recurrence_check;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_recurrence_check
  CHECK (recurrence IS NULL OR recurrence IN ('daily','weekdays','weekly'));

CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON public.tasks(recurrence) WHERE recurrence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL AND status <> 'done';

-- 2. task_comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_comments_select" ON public.task_comments
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
    )
  );
CREATE POLICY "task_comments_insert" ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id
          AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
      )
    )
  );
CREATE POLICY "task_comments_delete" ON public.task_comments
  FOR DELETE TO authenticated USING (
    author_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  );

-- 3. task_attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_name TEXT,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  content_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_attachments_select" ON public.task_attachments
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.tasks t WHERE t.id = task_id
        AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
    )
  );
CREATE POLICY "task_attachments_insert" ON public.task_attachments
  FOR INSERT TO authenticated WITH CHECK (
    uploader_id = auth.uid() AND (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (
        SELECT 1 FROM public.tasks t WHERE t.id = task_id
          AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
      )
    )
  );
CREATE POLICY "task_attachments_delete" ON public.task_attachments
  FOR DELETE TO authenticated USING (
    uploader_id = auth.uid() OR public.has_role(auth.uid(),'admin')
  );

-- 4. Cron joby na připomínky a denní souhrn
-- Použijeme anon publikovatelný klíč v apikey hlavičce
DO $$
DECLARE
  base_url TEXT := 'https://project--a5f2970c-6439-404d-be4b-7f82f0a3e916.lovable.app';
  anon_key TEXT := 'sb_publishable_X76h7c2uHFVm7WHiklG0VA_PZY9-GeH';
BEGIN
  -- Připomínky každých 15 minut (24h před + prošvihnuté)
  PERFORM cron.unschedule('task-reminders') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'task-reminders'
  );
  PERFORM cron.schedule(
    'task-reminders',
    '*/15 * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cron$,
      base_url || '/api/public/cron/task-reminders',
      json_build_object('Content-Type','application/json','apikey', anon_key)::text
    )
  );

  -- Denní souhrn každý den v 7:00 (Europe/Prague = UTC 6:00 v létě, 5:00 v zimě → použijeme 5:00 UTC)
  PERFORM cron.unschedule('task-daily-digest') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'task-daily-digest'
  );
  PERFORM cron.schedule(
    'task-daily-digest',
    '0 6 * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := %L::jsonb,
        body := '{}'::jsonb
      );
    $cron$,
      base_url || '/api/public/cron/task-daily-digest',
      json_build_object('Content-Type','application/json','apikey', anon_key)::text
    )
  );
END $$;