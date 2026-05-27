
-- ============ ai_story_history ============
CREATE TABLE public.ai_story_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  child_profile_id UUID,
  prompt_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_story JSONB NOT NULL DEFAULT '{}'::jsonb,
  sel_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  quality_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  language TEXT NOT NULL DEFAULT 'en',
  title TEXT,
  audio_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_story_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ai_story_history_user ON public.ai_story_history(user_id, created_at DESC);

CREATE POLICY "Users view own AI stories" ON public.ai_story_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own AI stories" ON public.ai_story_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own AI stories" ON public.ai_story_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own AI stories" ON public.ai_story_history FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all AI stories" ON public.ai_story_history FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_story_history_updated BEFORE UPDATE ON public.ai_story_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ blog_categories ============
CREATE TABLE public.blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads blog categories" ON public.blog_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage blog categories" ON public.blog_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_blog_categories_updated BEFORE UPDATE ON public.blog_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ blog_posts ============
CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
  title JSONB NOT NULL DEFAULT '{}'::jsonb,
  excerpt JSONB NOT NULL DEFAULT '{}'::jsonb,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  cover_image TEXT,
  author_name TEXT,
  reading_minutes INTEGER DEFAULT 3,
  tags TEXT[] DEFAULT '{}',
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_blog_posts_published ON public.blog_posts(published, published_at DESC);

CREATE POLICY "Anyone reads published blog posts" ON public.blog_posts FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
CREATE POLICY "Editors create blog posts" ON public.blog_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Editors update blog posts" ON public.blog_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'editor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete blog posts" ON public.blog_posts FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_blog_posts_updated BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ products ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name JSONB NOT NULL DEFAULT '{}'::jsonb,
  description JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT,
  image TEXT,
  gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_egp NUMERIC(10,2),
  price_usd NUMERIC(10,2),
  price_eur NUMERIC(10,2),
  age_range TEXT,
  stock INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_active ON public.products(active, featured);

CREATE POLICY "Anyone reads active products" ON public.products FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products" ON public.products FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ contact_messages ============
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone submits contact message" ON public.contact_messages FOR INSERT
  WITH CHECK (true);
CREATE POLICY "Admins view contact messages" ON public.contact_messages FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update contact messages" ON public.contact_messages FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete contact messages" ON public.contact_messages FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_contact_messages_updated BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ generated_illustrations ============
CREATE TABLE public.generated_illustrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.ai_story_history(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page_index INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT,
  style TEXT DEFAULT 'watercolor',
  character_profile_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, page_index)
);
ALTER TABLE public.generated_illustrations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_generated_illustrations_story ON public.generated_illustrations(story_id);

CREATE POLICY "Users view own illustrations" ON public.generated_illustrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own illustrations" ON public.generated_illustrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own illustrations" ON public.generated_illustrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own illustrations" ON public.generated_illustrations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_generated_illustrations_updated BEFORE UPDATE ON public.generated_illustrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ reading_streaks ============
CREATE TABLE public.reading_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_stories_read INTEGER NOT NULL DEFAULT 0,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reading_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own streak" ON public.reading_streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own streak" ON public.reading_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own streak" ON public.reading_streaks FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_reading_streaks_updated BEFORE UPDATE ON public.reading_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
