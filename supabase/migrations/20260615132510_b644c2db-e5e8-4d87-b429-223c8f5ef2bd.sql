CREATE OR REPLACE FUNCTION public.next_demo_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
BEGIN
  v_num := nextval('public.demo_invoice_seq');
  RETURN 'ZF-' || to_char(now(), 'YYYY') || '-' || lpad(v_num::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_demo_invoice_number() TO authenticated, service_role;