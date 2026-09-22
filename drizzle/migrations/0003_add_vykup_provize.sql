ALTER TABLE public.vykupy
  ADD COLUMN IF NOT EXISTS provize_vyplacena boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provize_vyplacena_at timestamptz;

COMMENT ON COLUMN public.vykupy.provize_vyplacena IS 'Provize (10 % ze zisku bez DPH) byla vyrovnána/vyplacena';