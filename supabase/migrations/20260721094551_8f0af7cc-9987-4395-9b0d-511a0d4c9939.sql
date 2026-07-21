ALTER TABLE public.backup_runs DROP CONSTRAINT IF EXISTS backup_runs_trigger_check;
ALTER TABLE public.backup_runs ADD CONSTRAINT backup_runs_trigger_check
  CHECK (trigger = ANY (ARRAY['manual'::text, 'scheduled'::text, 'restore'::text]));