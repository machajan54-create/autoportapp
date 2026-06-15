
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS geo_lat numeric,
  ADD COLUMN IF NOT EXISTS geo_lng numeric,
  ADD COLUMN IF NOT EXISTS geo_accuracy numeric,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_records_approval_status_check'
  ) THEN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_approval_status_check
      CHECK (approval_status IN ('draft','submitted','approved','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS attendance_records_approval_status_idx
  ON public.attendance_records (approval_status);

ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS rounding_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_overtime_threshold_hours numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS weekly_overtime_threshold_hours numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS require_record_approval boolean NOT NULL DEFAULT false;
