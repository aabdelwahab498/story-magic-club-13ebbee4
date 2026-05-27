CREATE TABLE public.story_generation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  cinematic_fields_enabled jsonb NOT NULL DEFAULT '{"visualPrompt":true,"animationPrompt":true,"voiceOver":true,"dialogue":true,"soundEffects":true,"backgroundMusic":true,"imagePrompt":true,"videoPrompt":true}'::jsonb,
  system_prompt_override text,
  user_prompt_addendum text,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  temperature numeric NOT NULL DEFAULT 0.85,
  quality_threshold int NOT NULL DEFAULT 18,
  max_regenerations int NOT NULL DEFAULT 2,
  default_visual_style text NOT NULL DEFAULT 'Pixar/Ghibli',
  banned_words text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.story_generation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads story settings"
  ON public.story_generation_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage story settings"
  ON public.story_generation_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_story_settings_updated_at
  BEFORE UPDATE ON public.story_generation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.story_generation_settings (singleton) VALUES (true);