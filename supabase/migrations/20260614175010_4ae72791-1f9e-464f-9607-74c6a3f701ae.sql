CREATE TABLE public.logbook_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  spz text,
  body_number text,
  responsible_person text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logbook_vehicles TO authenticated;
GRANT ALL ON public.logbook_vehicles TO service_role;
ALTER TABLE public.logbook_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logbook users manage vehicles" ON public.logbook_vehicles
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'logbook'))
  WITH CHECK (public.has_module(auth.uid(), 'logbook'));
CREATE TRIGGER trg_logbook_vehicles_touch
  BEFORE UPDATE ON public.logbook_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.logbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.logbook_vehicles(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  route text,
  purpose text,
  km_driven numeric(10,2),
  odometer numeric(10,2),
  fuel_liters numeric(10,2),
  fuel_cost_czk numeric(12,2),
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_logbook_entries_vehicle_date ON public.logbook_entries(vehicle_id, entry_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.logbook_entries TO authenticated;
GRANT ALL ON public.logbook_entries TO service_role;
ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logbook users manage entries" ON public.logbook_entries
  FOR ALL TO authenticated
  USING (public.has_module(auth.uid(), 'logbook'))
  WITH CHECK (public.has_module(auth.uid(), 'logbook'));
CREATE TRIGGER trg_logbook_entries_touch
  BEFORE UPDATE ON public.logbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
