-- Departments enum and profile fields
CREATE TYPE public.app_department AS ENUM ('vedeni', 'obchod', 'servis', 'nahradni_dily');

ALTER TABLE public.profiles
  ADD COLUMN department public.app_department NULL,
  ADD COLUMN is_department_head boolean NOT NULL DEFAULT false;

-- Index pro rychlé hledání nadřízeného daného oddělení
CREATE INDEX idx_profiles_department_head ON public.profiles(department) WHERE is_department_head = true;