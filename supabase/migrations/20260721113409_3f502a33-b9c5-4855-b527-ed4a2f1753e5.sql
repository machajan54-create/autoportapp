
CREATE TABLE public.tv_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text,
  name text,
  contact text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.tv_feedback TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.tv_feedback TO authenticated;
GRANT ALL ON public.tv_feedback TO service_role;

ALTER TABLE public.tv_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon on TV display) can submit feedback with basic length limits
CREATE POLICY "tv_feedback_insert_public" ON public.tv_feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(message) BETWEEN 1 AND 2000
    AND (name IS NULL OR char_length(name) <= 100)
    AND (contact IS NULL OR char_length(contact) <= 200)
    AND (token IS NULL OR char_length(token) <= 100)
  );

-- Only admins can read/manage feedback
CREATE POLICY "tv_feedback_select_admin" ON public.tv_feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tv_feedback_delete_admin" ON public.tv_feedback
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
