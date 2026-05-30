
CREATE TABLE public.illustration_job_cache (
  cache_key text PRIMARY KEY,
  user_id uuid NOT NULL,
  story_id text NOT NULL,
  idempotency_key text NOT NULL,
  page_signature text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX illustration_job_cache_expires_idx ON public.illustration_job_cache (expires_at);

GRANT ALL ON public.illustration_job_cache TO service_role;
ALTER TABLE public.illustration_job_cache ENABLE ROW LEVEL SECURITY;
-- No policies → no anon/authenticated access. Service role bypasses RLS.

CREATE TABLE public.illustration_job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  story_id text NOT NULL,
  idempotency_key text,
  event text NOT NULL,
  page_index int,
  status text,
  error text,
  latency_ms int,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX illustration_job_events_story_idx ON public.illustration_job_events (story_id, created_at DESC);
CREATE INDEX illustration_job_events_key_idx   ON public.illustration_job_events (idempotency_key);

GRANT ALL ON public.illustration_job_events TO service_role;
ALTER TABLE public.illustration_job_events ENABLE ROW LEVEL SECURITY;
-- No policies → write-only via service role from edge functions.
