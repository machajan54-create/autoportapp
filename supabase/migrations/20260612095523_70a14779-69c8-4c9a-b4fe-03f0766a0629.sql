
-- 1. Hide pin column from attendance_employees for all roles except service_role.
--    The terminal check-in path uses supabaseAdmin (service_role) which keeps full access.
REVOKE ALL (pin) ON public.attendance_employees FROM PUBLIC, anon, authenticated;

-- 2. Restrict Realtime subscriptions to users with the dochazka module
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dochazka users can read realtime messages" ON realtime.messages;
CREATE POLICY "dochazka users can read realtime messages"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (public.has_module(auth.uid(), 'dochazka'));

-- 3. Set search_path on email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
