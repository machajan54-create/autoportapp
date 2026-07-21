
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','error')),
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual','scheduled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  size_bytes bigint,
  tables_count integer,
  rows_count integer,
  drive_file_id text,
  drive_file_name text,
  drive_web_view_link text,
  error text,
  started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read backup runs"
  ON public.backup_runs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage backup runs"
  ON public.backup_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS backup_runs_started_at_idx ON public.backup_runs (started_at DESC);
