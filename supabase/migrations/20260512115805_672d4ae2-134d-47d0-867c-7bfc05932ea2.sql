-- 1. Embed video URL on stories + ai_story_history
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS video_embed_url TEXT;
ALTER TABLE public.ai_story_history ADD COLUMN IF NOT EXISTS video_embed_url TEXT;

-- 2. Music cache table
CREATE TABLE IF NOT EXISTS public.story_music_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  theme TEXT NOT NULL,
  mood TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_story_music_cache_key ON public.story_music_cache(cache_key);

ALTER TABLE public.story_music_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads music cache"
  ON public.story_music_cache FOR SELECT
  USING (true);

CREATE POLICY "Admins manage music cache"
  ON public.story_music_cache FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3. Public bucket for music
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-music', 'story-music', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read story music"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'story-music');

CREATE POLICY "Service writes story music"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'story-music');