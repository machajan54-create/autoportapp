
-- 1) Add new app module
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'demo_orders';

-- 2) Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  company TEXT,
  ico TEXT,
  dic TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update clients" ON public.clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete clients" ON public.clients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Sequences for order/invoice numbers (per year)
CREATE SEQUENCE IF NOT EXISTS public.demo_order_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.demo_invoice_seq START 1;

-- 4) Demo orders
CREATE TABLE public.demo_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  invoice_number TEXT UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  model_verze TEXT,
  vin TEXT,
  barva TEXT,
  najete_km INT,
  rok_vyroby INT,
  zaruka_spustena_od TEXT,
  registrace_datum DATE,
  datum_objednavky DATE NOT NULL DEFAULT CURRENT_DATE,
  datum_dodani DATE,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  cena_celkem_bez_dph NUMERIC(14,2) NOT NULL DEFAULT 0,
  cena_celkem_s_dph NUMERIC(14,2) NOT NULL DEFAULT 0,
  zaloha NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_orders TO authenticated;
GRANT ALL ON public.demo_orders TO service_role;
ALTER TABLE public.demo_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read orders" ON public.demo_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write orders" ON public.demo_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update orders" ON public.demo_orders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "admin delete orders" ON public.demo_orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_demo_orders_updated BEFORE UPDATE ON public.demo_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Assign order_number on insert
CREATE OR REPLACE FUNCTION public.assign_demo_order_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'OBJ-' || to_char(now(),'YYYY') || '-' ||
      lpad(nextval('public.demo_order_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_demo_orders_num BEFORE INSERT ON public.demo_orders FOR EACH ROW EXECUTE FUNCTION public.assign_demo_order_number();

-- 5) Documents (generated PDFs)
CREATE TABLE public.demo_order_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.demo_orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/pdf',
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_order_documents TO authenticated;
GRANT ALL ON public.demo_order_documents TO service_role;
ALTER TABLE public.demo_order_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read docs" ON public.demo_order_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert docs" ON public.demo_order_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin delete docs" ON public.demo_order_documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6) Signatures (in-person & remote)
CREATE TABLE public.demo_order_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.demo_orders(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  signer_name TEXT,
  signature_data TEXT,
  ip TEXT,
  user_agent TEXT,
  token UUID UNIQUE,
  token_expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_order_signatures TO authenticated;
GRANT ALL ON public.demo_order_signatures TO service_role;
-- Allow anon read of a signature row by valid token (for remote sign page)
GRANT SELECT, UPDATE ON public.demo_order_signatures TO anon;
ALTER TABLE public.demo_order_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sigs" ON public.demo_order_signatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sigs" ON public.demo_order_signatures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update sigs" ON public.demo_order_signatures FOR UPDATE TO authenticated USING (true);
-- Note: anon access actually goes through service_role in server fns; no anon policy needed.
REVOKE SELECT, UPDATE ON public.demo_order_signatures FROM anon;
