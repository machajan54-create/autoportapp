
ALTER TABLE public.evidence_orders
  ADD COLUMN IF NOT EXISTS pickup_from timestamptz,
  ADD COLUMN IF NOT EXISTS complete_by timestamptz;

CREATE INDEX IF NOT EXISTS idx_evidence_orders_pickup_from
  ON public.evidence_orders (pickup_from);

ALTER TABLE public.evidence_wash_assignments
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_evidence_wa_status_pending
  ON public.evidence_wash_assignments (status)
  WHERE status = 'pending';
