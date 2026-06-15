ALTER TABLE public.attendance_absences
  ADD COLUMN IF NOT EXISTS requested_resolver uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_absences_requested_resolver
  ON public.attendance_absences(requested_resolver);