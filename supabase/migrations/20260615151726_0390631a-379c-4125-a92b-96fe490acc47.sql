SELECT cron.unschedule('wash-reminders-daily');

SELECT cron.schedule(
  'wash-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--a5f2970c-6439-404d-be4b-7f82f0a3e916.lovable.app/api/public/hooks/wash-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);