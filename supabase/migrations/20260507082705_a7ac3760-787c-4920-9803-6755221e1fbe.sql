DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname ILIKE '%daily-price-snapshot%' OR command ILIKE '%daily-price-snapshot%' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;