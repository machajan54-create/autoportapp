
-- New enum values
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'in_repair';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'waiting_vat';
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'done';

-- Columns on claims
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS pu_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS vat_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS upload_token uuid NOT NULL DEFAULT gen_random_uuid();

-- PU number sequence per year
CREATE SEQUENCE IF NOT EXISTS public.claims_pu_seq;

CREATE OR REPLACE FUNCTION public.assign_pu_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pu_number IS NULL THEN
    NEW.pu_number := 'PU-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('public.claims_pu_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS claims_assign_pu_number ON public.claims;
CREATE TRIGGER claims_assign_pu_number
BEFORE INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.assign_pu_number();

-- Backfill any existing rows
UPDATE public.claims
SET pu_number = 'PU-' || to_char(created_at, 'YYYY') || '-' ||
                lpad(nextval('public.claims_pu_seq')::text, 4, '0')
WHERE pu_number IS NULL;

-- Timeline events
CREATE TABLE IF NOT EXISTS public.claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.claim_events TO authenticated;
GRANT SELECT, INSERT ON public.claim_events TO anon;
GRANT ALL ON public.claim_events TO service_role;
ALTER TABLE public.claim_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_select_auth ON public.claim_events FOR SELECT TO authenticated USING (true);
CREATE POLICY events_insert_any ON public.claim_events FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Tasks
CREATE TABLE IF NOT EXISTS public.claim_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_tasks TO authenticated;
GRANT ALL ON public.claim_tasks TO service_role;
ALTER TABLE public.claim_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_all_auth ON public.claim_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Event when new claim is created
CREATE OR REPLACE FUNCTION public.log_claim_created()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.claim_events (claim_id, type, message)
  VALUES (NEW.id, 'created', 'Zakázka vytvořena klientem přes veřejný formulář');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS claims_log_created ON public.claims;
CREATE TRIGGER claims_log_created
AFTER INSERT ON public.claims
FOR EACH ROW EXECUTE FUNCTION public.log_claim_created();
