CREATE TABLE public.cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  frequency text NOT NULL DEFAULT 'as_needed',
  weekdays smallint[] NOT NULL DEFAULT '{}',
  note text,
  category text NOT NULL DEFAULT 'daily',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_tasks TO authenticated;
GRANT ALL ON public.cleaning_tasks TO service_role;

ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY cleaning_tasks_select ON public.cleaning_tasks
  FOR SELECT TO authenticated USING (public.is_approved_user(auth.uid()));
CREATE POLICY cleaning_tasks_insert ON public.cleaning_tasks
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY cleaning_tasks_update ON public.cleaning_tasks
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY cleaning_tasks_delete ON public.cleaning_tasks
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER cleaning_tasks_touch BEFORE UPDATE ON public.cleaning_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cleaning_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.cleaning_tasks(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Prague')::date,
  done_by uuid REFERENCES auth.users(id),
  done_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, log_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_logs TO authenticated;
GRANT ALL ON public.cleaning_logs TO service_role;

ALTER TABLE public.cleaning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY cleaning_logs_select ON public.cleaning_logs
  FOR SELECT TO authenticated USING (public.is_approved_user(auth.uid()));
CREATE POLICY cleaning_logs_insert ON public.cleaning_logs
  FOR INSERT TO authenticated WITH CHECK (done_by = auth.uid());
CREATE POLICY cleaning_logs_update ON public.cleaning_logs
  FOR UPDATE TO authenticated USING (done_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (done_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY cleaning_logs_delete ON public.cleaning_logs
  FOR DELETE TO authenticated USING (done_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX cleaning_logs_date_idx ON public.cleaning_logs (log_date DESC);