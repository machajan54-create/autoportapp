ALTER TABLE public.attendance_employees
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'HPP'
    CHECK (employment_type IN ('HPP','DPP'));