
CREATE TABLE public.download_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  story_id TEXT,
  story_title TEXT,
  format TEXT NOT NULL CHECK (format IN ('pdf','mp3','txt','docx','epub','images','pack')),
  outcome TEXT NOT NULL CHECK (outcome IN ('success','rejected','error')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_download_audit_log_created_at ON public.download_audit_log (created_at DESC);
CREATE INDEX idx_download_audit_log_user ON public.download_audit_log (user_id, created_at DESC);
CREATE INDEX idx_download_audit_log_format ON public.download_audit_log (format, created_at DESC);
CREATE INDEX idx_download_audit_log_outcome ON public.download_audit_log (outcome, created_at DESC);

GRANT INSERT ON public.download_audit_log TO authenticated;
GRANT SELECT ON public.download_audit_log TO authenticated;
GRANT ALL ON public.download_audit_log TO service_role;

ALTER TABLE public.download_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own audit rows"
  ON public.download_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit rows"
  ON public.download_audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete audit rows"
  ON public.download_audit_log FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
