ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'defects';

CREATE TABLE public.defects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'new' check (status in ('new','in_progress','resolved','closed')),
  photos jsonb not null default '[]'::jsonb,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reporter_name text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolver_name text,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.defects TO authenticated;
GRANT ALL ON public.defects TO service_role;

ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "defects_select_authenticated" ON public.defects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "defects_insert_self" ON public.defects
  FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());

CREATE POLICY "defects_update_own_or_admin" ON public.defects
  FOR UPDATE TO authenticated
  USING (reported_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (reported_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "defects_delete_own_or_admin" ON public.defects
  FOR DELETE TO authenticated
  USING (reported_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_defects_updated_at BEFORE UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_defects_status ON public.defects(status);
CREATE INDEX idx_defects_reported_by ON public.defects(reported_by);