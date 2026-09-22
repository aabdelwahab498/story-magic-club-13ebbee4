-- Replace USING (true) SELECT policies on internal/admin tables with admin-only reads.

-- app_settings: read server-side via registration_allowed() (security definer)
DROP POLICY IF EXISTS "Anyone reads app settings" ON public.app_settings;
CREATE POLICY "Admins read app settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
REVOKE SELECT ON public.app_settings FROM anon;

-- audio_cache: internal TTS cache, only touched by edge functions (service role)
DROP POLICY IF EXISTS "Authenticated can read audio cache" ON public.audio_cache;
CREATE POLICY "Admins read audio cache" ON public.audio_cache
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- story_music_cache: internal music cache, written by edge functions (service role)
DROP POLICY IF EXISTS "Authenticated reads music cache" ON public.story_music_cache;
CREATE POLICY "Admins read music cache" ON public.story_music_cache
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- ai_feature_toggles: admin configuration
DROP POLICY IF EXISTS "Authenticated read feature toggles" ON public.ai_feature_toggles;
CREATE POLICY "Admins read feature toggles" ON public.ai_feature_toggles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- pdf_templates: admin-managed templates, rendered server-side
DROP POLICY IF EXISTS "pdf_tpl read auth" ON public.pdf_templates;
CREATE POLICY "pdf_tpl read admin" ON public.pdf_templates
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- user_backup_settings: global backup configuration (no per-user rows)
DROP POLICY IF EXISTS "Anyone authed reads settings" ON public.user_backup_settings;
CREATE POLICY "Admins read backup settings" ON public.user_backup_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
