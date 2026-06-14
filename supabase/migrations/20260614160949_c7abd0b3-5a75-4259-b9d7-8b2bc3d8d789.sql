ALTER TABLE public.attendance_employees
  ADD COLUMN IF NOT EXISTS employment_types text[] NOT NULL DEFAULT ARRAY['HPP']::text[];

UPDATE public.attendance_employees
SET employment_types = ARRAY[employment_type]::text[]
WHERE employment_type IS NOT NULL
  AND employment_types = ARRAY['HPP']::text[];

ALTER TABLE public.attendance_employees
  DROP CONSTRAINT IF EXISTS attendance_employees_employment_type_check;

ALTER TABLE public.attendance_employees
  DROP COLUMN IF EXISTS employment_type;

ALTER TABLE public.attendance_employees
  ADD CONSTRAINT attendance_employees_employment_types_chk
    CHECK (
      employment_types <@ ARRAY['HPP','DPP']::text[]
      AND COALESCE(array_length(employment_types, 1), 0) >= 1
    );