ALTER TABLE public.demo_orders
  ADD COLUMN IF NOT EXISTS seller_signature_data text,
  ADD COLUMN IF NOT EXISTS seller_signer_name text,
  ADD COLUMN IF NOT EXISTS seller_signed_at timestamptz;