-- 1. download_settings: restrict full-row reads to admins, expose safe subset via view
DROP POLICY IF EXISTS "Authenticated read download settings" ON public.download_settings;
CREATE POLICY "Admins read download settings"
ON public.download_settings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.download_settings_public
WITH (security_invoker = off) AS
SELECT id, enable_pdf, enable_mp3, enable_txt, enable_docx, enable_epub,
       enable_images, enable_pack, daily_limit_per_user, max_file_size_mb
FROM public.download_settings;

GRANT SELECT ON public.download_settings_public TO authenticated, anon;

-- 2. audio_voice_profiles: restrict reads (incl. config) to admins/editors
DROP POLICY IF EXISTS "voices read auth" ON public.audio_voice_profiles;
CREATE POLICY "voices read admin"
ON public.audio_voice_profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE OR REPLACE VIEW public.audio_voice_profiles_public
WITH (security_invoker = off) AS
SELECT id, name, provider, voice_id, language, gender, sample_url, description, is_default
FROM public.audio_voice_profiles
WHERE active = true;

GRANT SELECT ON public.audio_voice_profiles_public TO authenticated, anon;