
CREATE TABLE public.download_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID,
  story_title TEXT,
  format TEXT NOT NULL CHECK (format IN ('pdf','mp3','txt','docx','epub','images','pack')),
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.download_history TO authenticated;
GRANT ALL ON public.download_history TO service_role;

ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own download history"
  ON public.download_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own download history"
  ON public.download_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own download history"
  ON public.download_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_download_history_user_created ON public.download_history(user_id, created_at DESC);
CREATE INDEX idx_download_history_story ON public.download_history(story_id);
