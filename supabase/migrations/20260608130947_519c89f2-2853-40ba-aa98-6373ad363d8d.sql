
CREATE TABLE IF NOT EXISTS public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage templates"
ON public.document_templates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tr_doc_tpl_updated_at
BEFORE UPDATE ON public.document_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.document_templates (key, title, body) VALUES
('jednani', 'Plná moc k jednání s pojišťovnou',
'PLNA MOC k jednani s pojistovnou

Zmocnitel: {{first_name}} {{last_name}}
Spolecnost: {{company}}
IC: {{ico}}
Adresa: {{address}}
Telefon: {{phone}}
E-mail: {{email}}

Zmocnenec: Pojistne udalosti s.r.o., IC 12345678

Pojistovna: {{insurer}}
Cislo skody: {{claim_number}}
Datum udalosti: {{event_at}}
Misto udalosti: {{location}}

Zmocnuji vyse uvedeneho zmocnence k zastupovani pri jednani s pojistovnou
ve veci nahore uvedene pojistne udalosti v plnem rozsahu.'),
('plneni', 'Plná moc k převzetí pojistného plnění',
'PLNA MOC k prevzeti pojistneho plneni

Zmocnitel: {{first_name}} {{last_name}}
Spolecnost: {{company}}
IC: {{ico}}
Adresa: {{address}}
Telefon: {{phone}}
E-mail: {{email}}

Zmocnenec: Pojistne udalosti s.r.o., IC 12345678

Pojistovna: {{insurer}}
Cislo skody: {{claim_number}}
Datum udalosti: {{event_at}}
Misto udalosti: {{location}}

Zmocnuji vyse uvedeneho zmocnence k prevzeti pojistneho plneni
ve veci nahore uvedene pojistne udalosti v plnem rozsahu.')
ON CONFLICT (key) DO NOTHING;
