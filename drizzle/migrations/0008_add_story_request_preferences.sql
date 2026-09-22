ALTER TABLE public.story_requests
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.story_requests.preferences IS 'Validated story-generation preferences, including the user custom brief and approved blueprint.';