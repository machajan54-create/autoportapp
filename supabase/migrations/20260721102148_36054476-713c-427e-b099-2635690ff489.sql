
ALTER TABLE public.backup_settings
  ADD COLUMN IF NOT EXISTS github_owner text,
  ADD COLUMN IF NOT EXISTS github_repo text,
  ADD COLUMN IF NOT EXISTS github_branch text DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS github_auto_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_github_snapshot_at timestamptz;

ALTER TABLE public.backup_runs DROP CONSTRAINT IF EXISTS backup_runs_trigger_check;
ALTER TABLE public.backup_runs ADD CONSTRAINT backup_runs_trigger_check
  CHECK (trigger = ANY (ARRAY['manual'::text, 'scheduled'::text, 'restore'::text, 'github_manual'::text, 'github_scheduled'::text]));

ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'database';
ALTER TABLE public.backup_runs DROP CONSTRAINT IF EXISTS backup_runs_kind_check;
ALTER TABLE public.backup_runs ADD CONSTRAINT backup_runs_kind_check
  CHECK (kind = ANY (ARRAY['database'::text, 'github'::text]));
