SELECT cron.unschedule('autoport-drive-backup') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autoport-drive-backup');

SELECT cron.schedule(
  'autoport-drive-backup',
  '5 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://autoportapp.lovable.app/api/public/cron/backup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);