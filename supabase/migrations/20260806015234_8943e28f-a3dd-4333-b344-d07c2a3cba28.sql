insert into public.app_settings (key, value)
values ('monthly_report_cron_secret', to_jsonb(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')))
on conflict (key) do nothing;

select cron.unschedule('monthly-activity-report') where exists (select 1 from cron.job where jobname = 'monthly-activity-report');

select cron.schedule(
  'monthly-activity-report',
  '0 3 1 * *',
  $$
  select net.http_post(
    url := 'https://szkezahvdumeiqmnlugj.supabase.co/functions/v1/send-monthly-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select value #>> '{}' from public.app_settings where key = 'monthly_report_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);