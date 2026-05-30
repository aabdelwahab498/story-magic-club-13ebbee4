-- Audit log for admin views of illustration analytics
CREATE TABLE public.illustration_analytics_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  filter_story_id text,
  filter_idempotency_key text,
  filter_range text,
  user_agent text,
  path text
);

GRANT SELECT, INSERT ON public.illustration_analytics_audit TO authenticated;
GRANT ALL ON public.illustration_analytics_audit TO service_role;

ALTER TABLE public.illustration_analytics_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view analytics audit"
  ON public.illustration_analytics_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert own analytics audit"
  ON public.illustration_analytics_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND auth.uid() = admin_user_id
  );

CREATE INDEX idx_illustration_analytics_audit_viewed_at
  ON public.illustration_analytics_audit (viewed_at DESC);
CREATE INDEX idx_illustration_analytics_audit_admin
  ON public.illustration_analytics_audit (admin_user_id, viewed_at DESC);