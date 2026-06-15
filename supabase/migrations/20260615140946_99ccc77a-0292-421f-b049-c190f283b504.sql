CREATE TABLE public.demo_order_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.demo_orders(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX demo_order_events_order_id_idx ON public.demo_order_events(order_id, created_at DESC);

GRANT SELECT, INSERT ON public.demo_order_events TO authenticated;
GRANT ALL ON public.demo_order_events TO service_role;

ALTER TABLE public.demo_order_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo_order_events read" ON public.demo_order_events
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), 'demo_orders'::app_module));

CREATE POLICY "demo_order_events insert" ON public.demo_order_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), 'demo_orders'::app_module));
