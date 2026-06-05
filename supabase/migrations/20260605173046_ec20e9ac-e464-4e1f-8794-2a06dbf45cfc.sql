CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('najmah-reset-credits-daily', 'najmah-cleanup-rate-limits-daily') LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'najmah-reset-credits-daily',
  '0 2 * * *',
  $$ SELECT public.reset_monthly_credits(); $$
);

SELECT cron.schedule(
  'najmah-cleanup-rate-limits-daily',
  '0 3 * * *',
  $$ SELECT public.cleanup_rate_limit_events(); $$
);