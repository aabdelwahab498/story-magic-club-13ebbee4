
-- ============================================================
-- exports: tracks every TXT/MP3/PDF export produced via n8n
-- ============================================================
CREATE TABLE public.exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id uuid,
  child_id uuid REFERENCES public.child_profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('txt','mp3','pdf')),
  language text,
  file_path text,
  signed_url text,
  file_size bigint,
  provider text,
  status text NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating','ready','failed','expired')),
  dap_score numeric(4,2),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.exports TO authenticated;
GRANT ALL ON public.exports TO service_role;

ALTER TABLE public.exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own exports"
  ON public.exports FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert their own exports"
  ON public.exports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users may only update non-sensitive metadata (edge function uses service_role for state changes)
CREATE POLICY "Users cannot mutate exports directly"
  ON public.exports FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE INDEX idx_exports_user ON public.exports(user_id, created_at DESC);
CREATE INDEX idx_exports_story ON public.exports(story_id);
CREATE INDEX idx_exports_child ON public.exports(child_id);
CREATE INDEX idx_exports_status ON public.exports(status);

CREATE TRIGGER trg_exports_updated_at
  BEFORE UPDATE ON public.exports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- export_logs: audit trail (requested / generated / downloaded / failed / expired)
-- ============================================================
CREATE TABLE public.export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id uuid REFERENCES public.exports(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('requested','generated','downloaded','failed','expired','rate_limited')),
  ip_address inet,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.export_logs TO authenticated;
GRANT ALL ON public.export_logs TO service_role;

ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own export logs"
  ON public.export_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert their own export logs"
  ON public.export_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_export_logs_export ON public.export_logs(export_id);
CREATE INDEX idx_export_logs_user ON public.export_logs(user_id, created_at DESC);
