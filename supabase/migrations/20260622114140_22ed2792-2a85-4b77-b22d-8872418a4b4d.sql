
-- 1) Create a dedicated cron auth secret in Supabase Vault (random value, server-only).
DO $$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_auth_secret') THEN
    v_secret := encode(gen_random_bytes(32), 'hex');
    PERFORM vault.create_secret(v_secret, 'cron_auth_secret', 'Shared secret for /api/public/cron/* and /api/public/hooks/* endpoints');
  END IF;
END $$;

-- 2) Reschedule all cron jobs to pass the vault secret in `x-cron-secret` header (no more publishable key).
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN (
  'autoport-weekly-report',
  'task-reminders',
  'task-daily-digest',
  'task-daily-digest-weekdays-0830',
  'autoport-followup-reminders',
  'wash-reminders-hourly'
);

SELECT cron.schedule(
  'autoport-weekly-report',
  '0 7 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://autoportapp.lovable.app/api/public/hooks/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

SELECT cron.schedule(
  'task-reminders',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--a5f2970c-6439-404d-be4b-7f82f0a3e916.lovable.app/api/public/cron/task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'task-daily-digest',
  '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--a5f2970c-6439-404d-be4b-7f82f0a3e916.lovable.app/api/public/cron/task-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'task-daily-digest-weekdays-0830',
  '30 6 * * 1-5',
  $cron$
  SELECT net.http_post(
    url := 'https://project--a5f2970c-6439-404d-be4b-7f82f0a3e916.lovable.app/api/public/cron/task-daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

SELECT cron.schedule(
  'autoport-followup-reminders',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--citsunzrpbtobbzlkxlo.lovable.app/api/public/cron/followup-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'wash-reminders-hourly',
  '0 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--a5f2970c-6439-404d-be4b-7f82f0a3e916.lovable.app/api/public/hooks/wash-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

-- 3) RPC so the server (service role) can read the cron secret to compare against incoming requests.
CREATE OR REPLACE FUNCTION public.get_cron_auth_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret' LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_cron_auth_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_auth_secret() TO service_role;

-- 4) Guard trigger: prevent non-admins from approving/denying their own deletion requests.
CREATE OR REPLACE FUNCTION public.guard_deletion_requests_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.decided_by IS DISTINCT FROM OLD.decided_by
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
     OR NEW.decision_note IS DISTINCT FROM OLD.decision_note THEN
    RAISE EXCEPTION 'Schvalování žádostí o smazání může provést pouze administrátor.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_deletion_requests_approval ON public.deletion_requests;
CREATE TRIGGER trg_guard_deletion_requests_approval
BEFORE UPDATE ON public.deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_deletion_requests_approval();
