ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS amount_net numeric(14,2),
  ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) NOT NULL DEFAULT 21;

-- Backfill amount_net for existing rows from gross amount using default 21%
UPDATE public.purchases
   SET amount_net = ROUND(amount / (1 + (vat_rate/100))::numeric, 2)
 WHERE amount IS NOT NULL AND amount_net IS NULL;