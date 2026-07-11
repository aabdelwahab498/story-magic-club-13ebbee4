ALTER TABLE public.n8n_integration_settings
  ADD COLUMN IF NOT EXISTS story_webhook_url text,
  ADD COLUMN IF NOT EXISTS story_enabled boolean NOT NULL DEFAULT false;