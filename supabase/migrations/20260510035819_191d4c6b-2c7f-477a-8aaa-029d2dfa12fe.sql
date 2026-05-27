
-- Extend ai_story_history with structured SEL fields
ALTER TABLE public.ai_story_history
  ADD COLUMN IF NOT EXISTS pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sel_outcome jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS safety_passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regeneration_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS character_visual_hash text,
  ADD COLUMN IF NOT EXISTS age_band text,
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS quality_total integer;

-- Story safety audit reports
CREATE TABLE IF NOT EXISTS public.story_safety_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL,
  user_id uuid NOT NULL,
  piaget_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  bowlby_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  vygotsky_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  bibliotherapy_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  goleman_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  ibby_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  trauma_reject_check jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_score integer NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.story_safety_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own safety reports"
  ON public.story_safety_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own safety reports"
  ON public.story_safety_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all safety reports"
  ON public.story_safety_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_safety_reports_story ON public.story_safety_reports(story_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_user ON public.story_safety_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_story_history_child ON public.ai_story_history(child_profile_id);
