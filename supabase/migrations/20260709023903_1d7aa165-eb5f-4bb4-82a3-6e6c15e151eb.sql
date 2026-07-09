
-- ============================================================
-- audio_cache — content-hash based cache to skip repeat TTS work
-- ============================================================
CREATE TABLE public.audio_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash text NOT NULL UNIQUE,
  file_path text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('microsoft-edge','openai','elevenlabs','azure','google','local-fallback')),
  voice_id text NOT NULL,
  language text,
  duration_seconds integer,
  file_size bigint,
  used_count integer NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audio_cache TO authenticated;
GRANT ALL ON public.audio_cache TO service_role;
ALTER TABLE public.audio_cache ENABLE ROW LEVEL SECURITY;
-- Authenticated users can read cache metadata (needed for hit detection), but writes go through service_role
CREATE POLICY "Authenticated can read audio cache"
  ON public.audio_cache FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_audio_cache_hash ON public.audio_cache(content_hash);
CREATE INDEX idx_audio_cache_last_used ON public.audio_cache(last_used_at);

-- ============================================================
-- voice_configs — TTS voice catalog (admin-editable later)
-- ============================================================
CREATE TABLE public.voice_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code text NOT NULL,
  voice_id text NOT NULL,
  display_name text,
  provider text NOT NULL,
  gender text CHECK (gender IN ('male','female','neutral')),
  age_group text CHECK (age_group IN ('child','teen','adult')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sample_url text,
  emotion_hint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language_code, voice_id, provider)
);
GRANT SELECT ON public.voice_configs TO authenticated, anon;
GRANT ALL ON public.voice_configs TO service_role;
ALTER TABLE public.voice_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active voices"
  ON public.voice_configs FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "Admins can manage voices"
  ON public.voice_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.voice_configs (language_code, voice_id, display_name, provider, gender, age_group, is_default) VALUES
  ('ar', 'ar-SA-HamedNeural',  'حامد (رجل هادئ)',   'microsoft-edge', 'male',   'adult', true),
  ('ar', 'ar-EG-SalmaNeural',  'سلمى (امرأة دافئة)', 'microsoft-edge', 'female', 'adult', false),
  ('en', 'en-US-JennyNeural',  'Jenny (friendly)',   'microsoft-edge', 'female', 'adult', true),
  ('en', 'en-US-GuyNeural',    'Guy (calm)',         'microsoft-edge', 'male',   'adult', false),
  ('fr', 'fr-FR-DeniseNeural', 'Denise',             'microsoft-edge', 'female', 'adult', true),
  ('de', 'de-DE-KatjaNeural',  'Katja',              'microsoft-edge', 'female', 'adult', true),
  ('es', 'es-ES-ElviraNeural', 'Elvira',             'microsoft-edge', 'female', 'adult', true),
  ('pt', 'pt-BR-FranciscaNeural','Francisca',        'microsoft-edge', 'female', 'adult', true);

-- ============================================================
-- Extend exports with per-type metadata containers
-- ============================================================
ALTER TABLE public.exports
  ADD COLUMN IF NOT EXISTS audio_metadata jsonb,
  ADD COLUMN IF NOT EXISTS pdf_metadata   jsonb;
