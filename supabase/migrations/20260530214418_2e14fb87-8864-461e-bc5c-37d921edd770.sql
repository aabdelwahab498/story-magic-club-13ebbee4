
-- Grant authenticated SELECT access (RLS will narrow to admins).
GRANT SELECT ON public.illustration_job_events TO authenticated;
GRANT SELECT ON public.illustration_job_cache TO authenticated;

ALTER TABLE public.illustration_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.illustration_job_cache  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view illustration events" ON public.illustration_job_events;
CREATE POLICY "Admins view illustration events"
ON public.illustration_job_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins view illustration cache" ON public.illustration_job_cache;
CREATE POLICY "Admins view illustration cache"
ON public.illustration_job_cache
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Helpful indexes for the admin charts.
CREATE INDEX IF NOT EXISTS idx_illustration_events_created_at
  ON public.illustration_job_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_illustration_events_story_id
  ON public.illustration_job_events (story_id);
CREATE INDEX IF NOT EXISTS idx_illustration_events_idempotency_key
  ON public.illustration_job_events (idempotency_key);
