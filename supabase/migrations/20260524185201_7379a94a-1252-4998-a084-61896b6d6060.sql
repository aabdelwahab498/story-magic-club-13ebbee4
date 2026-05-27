
CREATE TABLE public.trial_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  child_name TEXT,
  theme TEXT,
  story_id TEXT,
  pages_count INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX trial_usage_fingerprint_uniq ON public.trial_usage(fingerprint);
CREATE INDEX trial_usage_ip_idx ON public.trial_usage(ip);

ALTER TABLE public.trial_usage ENABLE ROW LEVEL SECURITY;

-- Only admins can view. No insert/update/delete from clients — only the service role used by the edge function.
CREATE POLICY "Admins view trial usage"
  ON public.trial_usage
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
