CREATE TABLE public.vykupy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  znacka text NOT NULL,
  model text NOT NULL,
  rok_vyroby integer,
  pocet_km integer,
  klient text NOT NULL,
  telefon text,
  naceneno_od integer,
  vykoupeno_za integer,
  prodano_za integer,
  naklady integer NOT NULL DEFAULT 0,
  zdroj text,
  datum_vykupu date,
  stav text NOT NULL DEFAULT 'Nacenění',
  zpracoval text,
  poznamka text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vykupy TO authenticated;
GRANT ALL ON public.vykupy TO service_role;

ALTER TABLE public.vykupy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vykupy_all_auth" ON public.vykupy
  FOR ALL TO authenticated USING (true) WITH CHECK (true);