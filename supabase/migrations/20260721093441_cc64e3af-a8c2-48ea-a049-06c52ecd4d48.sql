CREATE TABLE public.backup_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  drive_folder_id text,
  drive_folder_name text,
  drive_account_email text,
  auto_backup_enabled boolean NOT NULL DEFAULT false,
  last_connected_at timestamptz,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_settings TO authenticated;
GRANT ALL ON public.backup_settings TO service_role;

ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage backup settings"
  ON public.backup_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_backup_settings_updated_at
  BEFORE UPDATE ON public.backup_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.backup_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;