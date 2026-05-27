
-- ============ child_profiles ============
CREATE TABLE public.child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id uuid NOT NULL,
  name text NOT NULL,
  age integer,
  avatar text,
  preferred_language text NOT NULL DEFAULT 'en',
  emotional_focus jsonb NOT NULL DEFAULT '[]'::jsonb,
  bedtime_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  reading_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_child_profiles_parent ON public.child_profiles(parent_user_id);

ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own children"
  ON public.child_profiles FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Admins view all children"
  ON public.child_profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Parents create own children"
  ON public.child_profiles FOR INSERT
  WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Parents update own children"
  ON public.child_profiles FOR UPDATE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents delete own children"
  ON public.child_profiles FOR DELETE
  USING (auth.uid() = parent_user_id);

CREATE TRIGGER update_child_profiles_updated_at
  BEFORE UPDATE ON public.child_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ bedtime_schedules ============
CREATE TABLE public.bedtime_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  parent_user_id uuid NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  dark_mode boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bedtime_child ON public.bedtime_schedules(child_profile_id);

ALTER TABLE public.bedtime_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own schedules"
  ON public.bedtime_schedules FOR SELECT
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents create own schedules"
  ON public.bedtime_schedules FOR INSERT
  WITH CHECK (auth.uid() = parent_user_id);

CREATE POLICY "Parents update own schedules"
  ON public.bedtime_schedules FOR UPDATE
  USING (auth.uid() = parent_user_id);

CREATE POLICY "Parents delete own schedules"
  ON public.bedtime_schedules FOR DELETE
  USING (auth.uid() = parent_user_id);

CREATE TRIGGER update_bedtime_schedules_updated_at
  BEFORE UPDATE ON public.bedtime_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ai_story_history → link to child ============
-- (column already exists; just add an index for parent-dashboard queries)
CREATE INDEX IF NOT EXISTS idx_ai_story_history_child
  ON public.ai_story_history(child_profile_id);
