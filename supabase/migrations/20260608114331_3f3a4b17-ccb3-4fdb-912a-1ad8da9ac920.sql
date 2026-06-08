
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
CREATE TYPE public.claim_status AS ENUM ('new', 'in_progress', 'closed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Claims
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status public.claim_status NOT NULL DEFAULT 'new',
  -- contact
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  ico TEXT,
  address TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  -- claim
  insurer TEXT,
  claim_number TEXT,
  event_at TIMESTAMPTZ,
  location TEXT,
  liquidation_type TEXT, -- 'havarijni' | 'povinne_ruceni'
  vat_payer TEXT,        -- 'ano' | 'ne'
  loan_lease TEXT,
  accident_record TEXT,
  insurer_record TEXT,
  notes TEXT,
  -- signature (data URL)
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.claims TO authenticated;
GRANT INSERT ON public.claims TO anon;
GRANT ALL ON public.claims TO service_role;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
-- Public can insert new claims; only authenticated employees can read/update
CREATE POLICY "claims_insert_anyone" ON public.claims FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "claims_select_auth" ON public.claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "claims_update_auth" ON public.claims FOR UPDATE TO authenticated USING (true);

-- Attachments (metadata; files in storage bucket claim-files)
CREATE TABLE public.claim_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- tp, rp, accident, damage, photos
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.claim_attachments TO authenticated;
GRANT INSERT ON public.claim_attachments TO anon;
GRANT ALL ON public.claim_attachments TO service_role;
ALTER TABLE public.claim_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attach_insert_anyone" ON public.claim_attachments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "attach_select_auth" ON public.claim_attachments FOR SELECT TO authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER claims_touch BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies: allow anyone to upload to claim-files, only authenticated to read
CREATE POLICY "claim_files_upload_anyone" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'claim-files');
CREATE POLICY "claim_files_read_auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'claim-files');
