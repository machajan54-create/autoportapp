
-- 1) Vehicle column
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS vehicle text;

-- 2) Stage history table
CREATE TABLE IF NOT EXISTS public.deal_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds bigint,
  changed_by uuid,
  changed_by_name text
);

CREATE INDEX IF NOT EXISTS deal_stage_history_deal_idx ON public.deal_stage_history(deal_id, changed_at DESC);

GRANT SELECT ON public.deal_stage_history TO authenticated;
GRANT ALL ON public.deal_stage_history TO service_role;

ALTER TABLE public.deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY deal_stage_history_select ON public.deal_stage_history
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_module(auth.uid(), 'deals'::app_module));

-- 3) Trigger function to log stage transitions with duration
CREATE OR REPLACE FUNCTION public.deals_log_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dur bigint;
  uid uuid;
  uname text;
BEGIN
  uid := auth.uid();
  IF uid IS NOT NULL THEN
    SELECT COALESCE(full_name, email) INTO uname FROM public.profiles WHERE id = uid;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.deal_stage_history(deal_id, from_stage, to_stage, changed_at, duration_seconds, changed_by, changed_by_name)
    VALUES (NEW.id, NULL, NEW.stage, COALESCE(NEW.stage_changed_at, now()), NULL, uid, uname);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    dur := EXTRACT(EPOCH FROM (now() - COALESCE(OLD.stage_changed_at, OLD.created_at)))::bigint;
    INSERT INTO public.deal_stage_history(deal_id, from_stage, to_stage, changed_at, duration_seconds, changed_by, changed_by_name)
    VALUES (NEW.id, OLD.stage, NEW.stage, now(), dur, uid, uname);
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deals_log_stage_history ON public.deals;
CREATE TRIGGER deals_log_stage_history
  AFTER INSERT OR UPDATE OF stage ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.deals_log_stage_history();

-- 4) Backfill: seed initial stage for existing deals that have no history
INSERT INTO public.deal_stage_history(deal_id, from_stage, to_stage, changed_at)
SELECT d.id, NULL, d.stage, COALESCE(d.stage_changed_at, d.created_at)
FROM public.deals d
LEFT JOIN public.deal_stage_history h ON h.deal_id = d.id
WHERE h.id IS NULL;
