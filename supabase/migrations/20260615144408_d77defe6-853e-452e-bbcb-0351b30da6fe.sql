
CREATE TABLE public.washers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.washers TO authenticated;
GRANT ALL ON public.washers TO service_role;
ALTER TABLE public.washers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "washers_select" ON public.washers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE POLICY "washers_admin_all" ON public.washers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_washers_touch BEFORE UPDATE ON public.washers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.evidence_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  klient text NOT NULL,
  vozidlo text NOT NULL,
  vis text,
  den date,
  hodina text,
  kdo_predava text,
  cislo_zakazky text,
  poznamka text,
  stav text NOT NULL DEFAULT 'nova',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT evidence_orders_stav_chk CHECK (stav IN ('nova','predano','zruseno'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_orders TO authenticated;
GRANT ALL ON public.evidence_orders TO service_role;
ALTER TABLE public.evidence_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_orders_select" ON public.evidence_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE POLICY "evidence_orders_insert" ON public.evidence_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE POLICY "evidence_orders_update" ON public.evidence_orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE POLICY "evidence_orders_delete" ON public.evidence_orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_evidence_orders_touch BEFORE UPDATE ON public.evidence_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_evidence_orders_den ON public.evidence_orders(den);

CREATE TABLE public.evidence_wash_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.evidence_orders(id) ON DELETE CASCADE,
  washer_id uuid NOT NULL REFERENCES public.washers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  confirm_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  sent_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT evidence_wa_status_chk CHECK (status IN ('pending','accepted','declined')),
  CONSTRAINT evidence_wa_unique UNIQUE (order_id, washer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_wash_assignments TO authenticated;
GRANT ALL ON public.evidence_wash_assignments TO service_role;
ALTER TABLE public.evidence_wash_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_wa_select" ON public.evidence_wash_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE POLICY "evidence_wa_insert" ON public.evidence_wash_assignments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE POLICY "evidence_wa_update" ON public.evidence_wash_assignments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE POLICY "evidence_wa_delete" ON public.evidence_wash_assignments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_module(auth.uid(),'evidence_zakazek'));
CREATE INDEX idx_evidence_wa_order ON public.evidence_wash_assignments(order_id);
CREATE INDEX idx_evidence_wa_washer ON public.evidence_wash_assignments(washer_id);
