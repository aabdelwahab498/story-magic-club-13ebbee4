DROP VIEW IF EXISTS public.download_settings_public;
DROP VIEW IF EXISTS public.audio_voice_profiles_public;

CREATE OR REPLACE FUNCTION public.get_download_settings_public()
RETURNS TABLE (
  enable_pdf boolean,
  enable_mp3 boolean,
  enable_txt boolean,
  enable_docx boolean,
  enable_epub boolean,
  enable_images boolean,
  enable_pack boolean,
  daily_limit_per_user integer,
  max_file_size_mb integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT enable_pdf, enable_mp3, enable_txt, enable_docx, enable_epub,
         enable_images, enable_pack, daily_limit_per_user, max_file_size_mb
  FROM public.download_settings
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_download_settings_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_download_settings_public() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.get_active_voice_profiles()
RETURNS TABLE (
  id uuid,
  name text,
  provider text,
  voice_id text,
  language text,
  gender text,
  sample_url text,
  description text,
  is_default boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, provider, voice_id, language, gender, sample_url, description, is_default
  FROM public.audio_voice_profiles
  WHERE active = true
  ORDER BY is_default DESC, name;
$$;

REVOKE ALL ON FUNCTION public.get_active_voice_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_voice_profiles() TO authenticated, anon, service_role;