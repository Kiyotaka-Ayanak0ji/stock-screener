select cron.unschedule('monthly-activity-report') where exists (select 1 from cron.job where jobname = 'monthly-activity-report');

select cron.schedule(
  'monthly-activity-report',
  '0 3 1 * *',
  $$
  select net.http_post(
    url := 'https://szkezahvdumeiqmnlugj.supabase.co/functions/v1/send-monthly-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);