-- Rate limiting infrastructure
CREATE TABLE IF NOT EXISTS public.rate_limit_events (
  id BIGSERIAL PRIMARY KEY,
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_lookup
  ON public.rate_limit_events (identifier, endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_events_cleanup
  ON public.rate_limit_events (created_at);

ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view rate limit events"
  ON public.rate_limit_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies: only service role writes

CREATE TABLE IF NOT EXISTS public.rate_limit_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  reason TEXT,
  blocked_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_blocks_lookup
  ON public.rate_limit_blocks (identifier, endpoint, blocked_until DESC);

ALTER TABLE public.rate_limit_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage rate limit blocks"
  ON public.rate_limit_blocks FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cleanup function: remove events older than 25 hours and expired blocks
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limit_events WHERE created_at < now() - INTERVAL '25 hours';
  DELETE FROM public.rate_limit_blocks WHERE blocked_until < now() - INTERVAL '1 hour';
END;
$$;

-- Schedule daily cleanup via pg_cron (extension assumed enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('rate-limit-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'rate-limit-cleanup',
  '17 3 * * *',
  $$ SELECT public.cleanup_rate_limit_data(); $$
);