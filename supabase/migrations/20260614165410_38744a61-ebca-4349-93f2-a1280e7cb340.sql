CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  client_name text,
  contact text,
  value_czk numeric(14,2),
  stage text NOT NULL DEFAULT 'lead',
  expected_close_date date,
  notes text,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY deals_select ON public.deals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_module(auth.uid(), 'deals'));

CREATE POLICY deals_insert ON public.deals FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_module(auth.uid(), 'deals'));

CREATE POLICY deals_update ON public.deals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_module(auth.uid(), 'deals'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_module(auth.uid(), 'deals'));

CREATE POLICY deals_delete ON public.deals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_module(auth.uid(), 'deals'));

CREATE TRIGGER deals_touch_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX deals_stage_idx ON public.deals(stage);
CREATE INDEX deals_owner_idx ON public.deals(owner_id);