select net.http_post(
  url := 'https://szkezahvdumeiqmnlugj.supabase.co/functions/v1/send-monthly-reports',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value #>> '{}' from public.app_settings where key='monthly_report_cron_secret')),
  body := '{}'::jsonb
) as request_id;