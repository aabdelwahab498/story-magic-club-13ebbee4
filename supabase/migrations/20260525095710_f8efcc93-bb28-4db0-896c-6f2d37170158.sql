DROP INDEX IF EXISTS public.trial_usage_fingerprint_uniq;
CREATE INDEX IF NOT EXISTS trial_usage_fingerprint_idx ON public.trial_usage (fingerprint);