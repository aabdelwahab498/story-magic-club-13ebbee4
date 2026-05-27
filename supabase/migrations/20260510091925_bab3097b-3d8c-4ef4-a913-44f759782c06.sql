ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS seo_title jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_description jsonb NOT NULL DEFAULT '{}'::jsonb;