
ALTER TABLE public.backup_settings
  ADD COLUMN IF NOT EXISTS schedule_frequency text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS schedule_time text NOT NULL DEFAULT '02:00',
  ADD COLUMN IF NOT EXISTS schedule_day_of_week smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS schedule_day_of_month smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS schedule_interval_hours smallint NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS last_backup_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_backup_at timestamptz;

ALTER TABLE public.backup_settings
  DROP CONSTRAINT IF EXISTS backup_settings_frequency_check;
ALTER TABLE public.backup_settings
  ADD CONSTRAINT backup_settings_frequency_check
  CHECK (schedule_frequency IN ('interval','daily','weekly','monthly'));

ALTER TABLE public.backup_settings
  DROP CONSTRAINT IF EXISTS backup_settings_time_check;
ALTER TABLE public.backup_settings
  ADD CONSTRAINT backup_settings_time_check
  CHECK (schedule_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
