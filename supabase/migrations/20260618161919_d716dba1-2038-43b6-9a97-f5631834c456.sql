CREATE TABLE public.batch_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID,
  formats TEXT[] NOT NULL DEFAULT ARRAY['pdf']::TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  total INT NOT NULL DEFAULT 0,
  completed INT NOT NULL DEFAULT 0,
  bundle_path TEXT,
  bundle_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.batch_export_jobs TO authenticated;
GRANT ALL ON public.batch_export_jobs TO service_role;

ALTER TABLE public.batch_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own batch jobs"
  ON public.batch_export_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own batch jobs"
  ON public.batch_export_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages all batch jobs"
  ON public.batch_export_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_batch_export_jobs_updated_at
  BEFORE UPDATE ON public.batch_export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_batch_export_jobs_user_status ON public.batch_export_jobs(user_id, status, created_at DESC);