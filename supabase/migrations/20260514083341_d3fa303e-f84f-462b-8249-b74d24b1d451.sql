-- =============================================================
-- Secure Upload Pipeline — Phase 1: Storage + Logging schema
-- =============================================================

-- 1. Buckets (all private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('temp-uploads', 'temp-uploads', false, 26214400,  -- 25 MB
    ARRAY['image/png','image/jpeg','image/webp','application/pdf','video/mp4','video/quicktime','video/webm']),
  ('user-files', 'user-files', false, 26214400,
    ARRAY['image/png','image/jpeg','image/webp','application/pdf']),
  ('drawing-entries', 'drawing-entries', false, 10485760,  -- 10 MB
    ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- 2. Storage object policies — user isolation by first folder = auth.uid()
--    Service role bypasses RLS so the finalize function can move files.

-- temp-uploads: user can insert + read + delete only their own folder
CREATE POLICY "temp_uploads_user_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'temp-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "temp_uploads_user_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'temp-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "temp_uploads_user_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'temp-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- user-files: read-only for owner; mutation only via service role (edge function)
CREATE POLICY "user_files_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- drawing-entries: owner SELECT + admin ALL (no public read; signed URLs only)
CREATE POLICY "drawing_entries_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'drawing-entries'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "drawing_entries_admin_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'drawing-entries' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'drawing-entries' AND public.has_role(auth.uid(), 'admin'));

-- 3. Security logging
CREATE TABLE public.upload_security_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  ip              TEXT,
  user_agent      TEXT,
  filename        TEXT,
  mime_declared   TEXT,
  mime_detected   TEXT,
  extension       TEXT,
  size_bytes      BIGINT,
  bucket          TEXT,
  target_path     TEXT,
  action          TEXT NOT NULL,        -- init | uploaded | scanned_clean | scanned_infected | rejected_validation | moved | error
  scan_engine     TEXT,                 -- clamav | none | failover
  scan_signature  TEXT,                 -- malware family if infected
  abuse_score     INT NOT NULL DEFAULT 0,
  details         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_upload_logs_user ON public.upload_security_logs (user_id, created_at DESC);
CREATE INDEX idx_upload_logs_action ON public.upload_security_logs (action, created_at DESC);
CREATE INDEX idx_upload_logs_ip ON public.upload_security_logs (ip, created_at DESC);

ALTER TABLE public.upload_security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all upload logs"
  ON public.upload_security_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own upload logs"
  ON public.upload_security_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. Scan job queue (resilient retry path; one row per finalize attempt)
CREATE TABLE public.file_scan_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  temp_path     TEXT NOT NULL,           -- inside temp-uploads
  target_bucket TEXT NOT NULL,
  target_path   TEXT NOT NULL,
  declared_mime TEXT,
  size_bytes    BIGINT,
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | scanning | clean | infected | failed
  attempts      INT NOT NULL DEFAULT 0,
  scan_result   JSONB NOT NULL DEFAULT '{}'::jsonb,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_jobs_status ON public.file_scan_jobs (status, created_at);
CREATE INDEX idx_scan_jobs_user ON public.file_scan_jobs (user_id, created_at DESC);

ALTER TABLE public.file_scan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scan jobs"
  ON public.file_scan_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all scan jobs"
  ON public.file_scan_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_file_scan_jobs_updated
  BEFORE UPDATE ON public.file_scan_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Quota helper — daily bytes uploaded per user (counts only successful moves)
CREATE OR REPLACE FUNCTION public.user_daily_upload_bytes(_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(size_bytes), 0)::BIGINT
  FROM public.upload_security_logs
  WHERE user_id = _user_id
    AND action = 'moved'
    AND created_at >= date_trunc('day', now());
$$;

REVOKE EXECUTE ON FUNCTION public.user_daily_upload_bytes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_daily_upload_bytes(UUID) TO authenticated, service_role;

-- 6. Auto-cleanup function — temp files older than 1 hour, old logs (90d), expired jobs
CREATE OR REPLACE FUNCTION public.cleanup_upload_pipeline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete temp-uploads objects older than 1 hour
  DELETE FROM storage.objects
   WHERE bucket_id = 'temp-uploads'
     AND created_at < now() - INTERVAL '1 hour';

  -- Mark stuck scan jobs as failed
  UPDATE public.file_scan_jobs
     SET status = 'failed', error = COALESCE(error, 'timeout')
   WHERE status IN ('pending','scanning')
     AND updated_at < now() - INTERVAL '2 hours';

  -- Trim old logs (>90 days) but keep infected forever
  DELETE FROM public.upload_security_logs
   WHERE created_at < now() - INTERVAL '90 days'
     AND action NOT IN ('scanned_infected','rejected_validation');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_upload_pipeline() FROM PUBLIC, anon, authenticated;

-- 7. Schedule cleanup daily at 03:33
SELECT cron.schedule(
  'upload-pipeline-cleanup',
  '33 3 * * *',
  $$ SELECT public.cleanup_upload_pipeline(); $$
);