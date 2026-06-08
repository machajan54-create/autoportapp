ALTER TABLE public.vykupy
  ADD COLUMN IF NOT EXISTS internal_priced_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS internal_priced_amount numeric,
  ADD COLUMN IF NOT EXISTS internal_priced_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_priced_by text,
  ADD COLUMN IF NOT EXISTS external_priced_amount numeric,
  ADD COLUMN IF NOT EXISTS external_priced_at timestamptz;