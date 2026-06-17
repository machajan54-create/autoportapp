
-- 1) PIN: presunout do samostatne tabulky, admin-only
CREATE TABLE IF NOT EXISTS public.attendance_employee_pins (
  employee_id uuid PRIMARY KEY REFERENCES public.attendance_employees(id) ON DELETE CASCADE,
  pin text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_employee_pins TO authenticated;
GRANT ALL ON public.attendance_employee_pins TO service_role;

ALTER TABLE public.attendance_employee_pins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_employee_pins_admin_select ON public.attendance_employee_pins;
DROP POLICY IF EXISTS attendance_employee_pins_admin_insert ON public.attendance_employee_pins;
DROP POLICY IF EXISTS attendance_employee_pins_admin_update ON public.attendance_employee_pins;
DROP POLICY IF EXISTS attendance_employee_pins_admin_delete ON public.attendance_employee_pins;
CREATE POLICY attendance_employee_pins_admin_select ON public.attendance_employee_pins
  FOR SELECT TO authenticated USING ( public.has_role(auth.uid(),'admin') );
CREATE POLICY attendance_employee_pins_admin_insert ON public.attendance_employee_pins
  FOR INSERT TO authenticated WITH CHECK ( public.has_role(auth.uid(),'admin') );
CREATE POLICY attendance_employee_pins_admin_update ON public.attendance_employee_pins
  FOR UPDATE TO authenticated USING ( public.has_role(auth.uid(),'admin') )
  WITH CHECK ( public.has_role(auth.uid(),'admin') );
CREATE POLICY attendance_employee_pins_admin_delete ON public.attendance_employee_pins
  FOR DELETE TO authenticated USING ( public.has_role(auth.uid(),'admin') );

-- Migrate existing data (only if pin column still exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='attendance_employees' AND column_name='pin'
  ) THEN
    EXECUTE $mig$
      INSERT INTO public.attendance_employee_pins (employee_id, pin)
      SELECT id, pin FROM public.attendance_employees WHERE pin IS NOT NULL AND pin <> ''
      ON CONFLICT (employee_id) DO UPDATE SET pin = EXCLUDED.pin, updated_at = now();
    $mig$;
    EXECUTE 'ALTER TABLE public.attendance_employees DROP COLUMN pin';
  END IF;
END $$;

CREATE TRIGGER trg_attendance_pins_touch
  BEFORE UPDATE ON public.attendance_employee_pins
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Pin verification function (security definer; never returns pin)
CREATE OR REPLACE FUNCTION public.verify_employee_pin(_pin text)
RETURNS TABLE(employee_id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name
  FROM public.attendance_employees e
  JOIN public.attendance_employee_pins p ON p.employee_id = e.id
  WHERE p.pin = _pin AND e.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_employee_pin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_employee_pin(text) TO anon, authenticated, service_role;

-- 2) Realtime: omezeni na admina
DROP POLICY IF EXISTS "dochazka users can read realtime messages" ON realtime.messages;
CREATE POLICY "admins can read realtime messages"
  ON realtime.messages FOR SELECT TO authenticated
  USING ( public.has_role(auth.uid(),'admin') );

-- 3) Cron job: doplnit apikey do wash-reminders
SELECT cron.unschedule('wash-reminders-hourly');
SELECT cron.schedule(
  'wash-reminders-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--a5f2970c-6439-404d-be4b-7f82f0a3e916.lovable.app/api/public/hooks/wash-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_X76h7c2uHFVm7WHiklG0VA_PZY9-GeH'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);
