
-- Enums for attendance
DO $$ BEGIN
  CREATE TYPE public.dochazka_absence_type AS ENUM ('dovolena','nemoc','lekar','neplacene_volno','jine');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dochazka_absence_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.dochazka_notification_type AS ENUM ('late_arrival','shift_ending','no_show','absence_pending','absence_resolved','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE public.attendance_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  pin text NOT NULL,
  avatar_color text NOT NULL DEFAULT 'blue',
  active boolean NOT NULL DEFAULT true,
  can_approve_absences boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.attendance_employees(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.attendance_shifts(id) ON DELETE SET NULL,
  date date NOT NULL,
  check_in timestamptz NOT NULL,
  check_out timestamptz,
  note text,
  break_duration integer NOT NULL DEFAULT 0,
  hours_worked numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attendance_records_employee_date_idx ON public.attendance_records(employee_id, date DESC);

CREATE TABLE public.attendance_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.attendance_employees(id) ON DELETE CASCADE,
  type public.dochazka_absence_type NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  note text,
  status public.dochazka_absence_status NOT NULL DEFAULT 'pending',
  resolved_by uuid REFERENCES public.attendance_employees(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.dochazka_notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  recipient_employee_id uuid REFERENCES public.attendance_employees(id) ON DELETE CASCADE,
  is_for_manager boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance_settings (
  id boolean PRIMARY KEY DEFAULT true,
  notify_employee_late boolean NOT NULL DEFAULT true,
  late_arrival_buffer_minutes integer NOT NULL DEFAULT 10,
  notify_employee_shift_ending boolean NOT NULL DEFAULT true,
  shift_ending_minutes_threshold integer NOT NULL DEFAULT 30,
  notify_manager_no_show boolean NOT NULL DEFAULT true,
  no_show_buffer_minutes integer NOT NULL DEFAULT 60,
  notify_manager_absence_pending boolean NOT NULL DEFAULT true,
  notify_employee_absence_resolved boolean NOT NULL DEFAULT true,
  custom_message_prefix text NOT NULL DEFAULT 'Hlavní Provoz',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_settings_singleton CHECK (id = true)
);

-- GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_absences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_employees TO service_role;
GRANT ALL ON public.attendance_shifts TO service_role;
GRANT ALL ON public.attendance_records TO service_role;
GRANT ALL ON public.attendance_absences TO service_role;
GRANT ALL ON public.attendance_notifications TO service_role;
GRANT ALL ON public.attendance_settings TO service_role;

-- RLS
ALTER TABLE public.attendance_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dochazka users access employees" ON public.attendance_employees
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'))
  WITH CHECK (public.has_module(auth.uid(), 'dochazka'));

CREATE POLICY "dochazka users access shifts" ON public.attendance_shifts
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'))
  WITH CHECK (public.has_module(auth.uid(), 'dochazka'));

CREATE POLICY "dochazka users access records" ON public.attendance_records
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'))
  WITH CHECK (public.has_module(auth.uid(), 'dochazka'));

CREATE POLICY "dochazka users access absences" ON public.attendance_absences
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'))
  WITH CHECK (public.has_module(auth.uid(), 'dochazka'));

CREATE POLICY "dochazka users access notifications" ON public.attendance_notifications
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'))
  WITH CHECK (public.has_module(auth.uid(), 'dochazka'));

CREATE POLICY "dochazka users access settings" ON public.attendance_settings
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'))
  WITH CHECK (public.has_module(auth.uid(), 'dochazka'));

-- updated_at triggers
CREATE TRIGGER touch_attendance_employees BEFORE UPDATE ON public.attendance_employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_attendance_shifts BEFORE UPDATE ON public.attendance_shifts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_attendance_records BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_attendance_absences BEFORE UPDATE ON public.attendance_absences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_attendance_settings BEFORE UPDATE ON public.attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Singleton settings row
INSERT INTO public.attendance_settings (id) VALUES (true) ON CONFLICT DO NOTHING;
