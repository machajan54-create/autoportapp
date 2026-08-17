CREATE TABLE public.task_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  role text NOT NULL DEFAULT 'participant',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id)
);

GRANT SELECT ON public.task_participants TO authenticated;
GRANT ALL ON public.task_participants TO service_role;

ALTER TABLE public.task_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_task_participant(_task_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.task_participants tp WHERE tp.task_id = _task_id AND tp.user_id = _uid)
$$;

CREATE POLICY "task_participants_select" ON public.task_participants
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR public.is_task_participant(task_id, auth.uid()));

-- backfill
INSERT INTO public.task_participants (task_id, user_id, user_name, role)
SELECT t.id, t.created_by, t.creator_name, 'creator' FROM public.tasks t WHERE t.created_by IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.task_participants (task_id, user_id, user_name, role)
SELECT t.id, t.assignee_id, t.assignee_name, 'assignee' FROM public.tasks t WHERE t.assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.task_participants (task_id, user_id, user_name, role)
SELECT DISTINCT c.task_id, c.author_id, c.author_name, 'commenter' FROM public.task_comments c WHERE c.author_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO public.task_participants (task_id, user_id, user_name, role)
SELECT DISTINCT a.task_id, a.uploader_id, a.uploader_name, 'uploader' FROM public.task_attachments a WHERE a.uploader_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- triggers
CREATE OR REPLACE FUNCTION public.tasks_sync_participants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.task_participants (task_id, user_id, user_name, role)
    VALUES (NEW.id, NEW.created_by, NEW.creator_name, 'creator') ON CONFLICT DO NOTHING;
  END IF;
  IF NEW.assignee_id IS NOT NULL THEN
    INSERT INTO public.task_participants (task_id, user_id, user_name, role)
    VALUES (NEW.id, NEW.assignee_id, NEW.assignee_name, 'assignee') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_sync_participants_trg
AFTER INSERT OR UPDATE OF assignee_id, created_by ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_participants();

CREATE OR REPLACE FUNCTION public.task_comment_sync_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.author_id IS NOT NULL THEN
    INSERT INTO public.task_participants (task_id, user_id, user_name, role)
    VALUES (NEW.task_id, NEW.author_id, NEW.author_name, 'commenter') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_comments_sync_participant_trg
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.task_comment_sync_participant();

CREATE OR REPLACE FUNCTION public.task_attachment_sync_participant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.uploader_id IS NOT NULL THEN
    INSERT INTO public.task_participants (task_id, user_id, user_name, role)
    VALUES (NEW.task_id, NEW.uploader_id, NEW.uploader_name, 'uploader') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_attachments_sync_participant_trg
AFTER INSERT ON public.task_attachments
FOR EACH ROW EXECUTE FUNCTION public.task_attachment_sync_participant();

-- widen read access to past participants
DROP POLICY "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
  OR assignee_id = auth.uid()
  OR public.is_task_participant(id, auth.uid())
);

DROP POLICY "task_comments_select" ON public.task_comments;
CREATE POLICY "task_comments_select" ON public.task_comments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.is_task_participant(task_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid()))
);

DROP POLICY "task_attachments_select" ON public.task_attachments;
CREATE POLICY "task_attachments_select" ON public.task_attachments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR public.is_task_participant(task_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid()))
);