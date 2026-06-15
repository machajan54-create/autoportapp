
CREATE TYPE public.deletion_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_label TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  status public.deletion_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX deletion_requests_unique_pending
  ON public.deletion_requests (entity_type, entity_id)
  WHERE status = 'pending';

CREATE INDEX deletion_requests_status_idx ON public.deletion_requests (status, created_at DESC);
CREATE INDEX deletion_requests_requested_by_idx ON public.deletion_requests (requested_by, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own deletion requests"
  ON public.deletion_requests FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own deletion requests"
  ON public.deletion_requests FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Users cancel own pending or admin updates"
  ON public.deletion_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (requested_by = auth.uid() AND status = 'pending')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (requested_by = auth.uid())
  );

CREATE POLICY "Admins delete deletion requests"
  ON public.deletion_requests FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER deletion_requests_set_updated_at
  BEFORE UPDATE ON public.deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
