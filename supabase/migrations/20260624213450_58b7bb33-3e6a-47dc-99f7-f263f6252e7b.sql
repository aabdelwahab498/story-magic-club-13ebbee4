
-- =============================================================
-- user_backups: per-user daily backup records
-- =============================================================
CREATE TABLE public.user_backups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  backup_date DATE NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  story_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','failed','running')),
  error_message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, backup_date)
);

GRANT SELECT, DELETE ON public.user_backups TO authenticated;
GRANT ALL ON public.user_backups TO service_role;

ALTER TABLE public.user_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own backups" ON public.user_backups
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own backups" ON public.user_backups
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all backups" ON public.user_backups
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX user_backups_user_idx ON public.user_backups (user_id, backup_date DESC);
CREATE INDEX user_backups_expires_idx ON public.user_backups (expires_at);

-- =============================================================
-- user_backup_settings: singleton config
-- =============================================================
CREATE TABLE public.user_backup_settings (
  id BOOLEAN NOT NULL DEFAULT true PRIMARY KEY CHECK (id = true),
  enabled BOOLEAN NOT NULL DEFAULT true,
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days >= 1 AND retention_days <= 365),
  max_size_mb_per_user INTEGER NOT NULL DEFAULT 500 CHECK (max_size_mb_per_user >= 10),
  notify_on_failure BOOLEAN NOT NULL DEFAULT true,
  notify_on_success BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_backup_settings TO authenticated;
GRANT ALL ON public.user_backup_settings TO service_role;

ALTER TABLE public.user_backup_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed reads settings" ON public.user_backup_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins update settings" ON public.user_backup_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert settings" ON public.user_backup_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_backup_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- =============================================================
-- user_notifications: in-app bell + toast feed
-- =============================================================
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','error')),
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.user_notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.user_notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.user_notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX user_notifications_user_idx ON public.user_notifications (user_id, created_at DESC);

-- =============================================================
-- Storage policies for user-backups bucket
-- Path structure: {user_id}/{YYYY-MM-DD}.json
-- =============================================================
CREATE POLICY "Users read own backup files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins read all backup files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own backup files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-backups' AND auth.uid()::text = (storage.foldername(name))[1]);
