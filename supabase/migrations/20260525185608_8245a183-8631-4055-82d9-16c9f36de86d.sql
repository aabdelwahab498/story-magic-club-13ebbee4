
-- User-supplied AI API keys for story/image/PDF generation
CREATE TABLE public.user_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  label text,
  api_key text NOT NULL,
  base_url text,
  text_model text,
  image_model text,
  capabilities text[] NOT NULL DEFAULT ARRAY['text','image']::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_api_keys_provider_check CHECK (provider IN ('openai','google','openrouter','anthropic','pollinations','replicate','stability','custom'))
);

CREATE INDEX idx_user_api_keys_user ON public.user_api_keys(user_id);
CREATE UNIQUE INDEX uniq_user_api_keys_user_provider_label ON public.user_api_keys(user_id, provider, COALESCE(label,''));

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api keys"
  ON public.user_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own api keys"
  ON public.user_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own api keys"
  ON public.user_api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own api keys"
  ON public.user_api_keys FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_api_keys_updated
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
