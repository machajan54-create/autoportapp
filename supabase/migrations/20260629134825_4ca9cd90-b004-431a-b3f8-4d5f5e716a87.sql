
ALTER TABLE public.vykupy
  ADD COLUMN IF NOT EXISTS owner_expectation_czk numeric,
  ADD COLUMN IF NOT EXISTS naklady_popis text,
  ADD COLUMN IF NOT EXISTS new_in_cz boolean,
  ADD COLUMN IF NOT EXISTS service_history boolean,
  ADD COLUMN IF NOT EXISTS barva text;
