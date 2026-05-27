ALTER TABLE public.trial_usage
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stage TEXT;

CREATE INDEX IF NOT EXISTS trial_usage_error_idx ON public.trial_usage (error_code) WHERE error_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS trial_usage_fallback_idx ON public.trial_usage (fallback_used) WHERE fallback_used = true;
CREATE INDEX IF NOT EXISTS trial_usage_created_idx ON public.trial_usage (created_at DESC);