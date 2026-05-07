DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname ILIKE '%daily-price-snapshot%'
       OR jobname ILIKE '%import-stock-history%'
       OR command ILIKE '%daily-price-snapshot%'
       OR command ILIKE '%import-stock-history%'
       OR command ILIKE '%stock_price_history%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled cron job %: %', r.jobid, r.jobname;
  END LOOP;
END $$;