
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.ai_tone AS ENUM ('professional','friendly','educational','marketing','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_limit_scope AS ENUM ('global','role','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_usage_status AS ENUM ('success','error','blocked','quota_exceeded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend app_role enum (idempotent)
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'editor';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
EXCEPTION WHEN others THEN NULL; END $$;

-- ============ AI AGENTS ============
CREATE TABLE IF NOT EXISTS public.ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  system_prompt text NOT NULL DEFAULT '',
  tone public.ai_tone NOT NULL DEFAULT 'friendly',
  custom_tone_text text,
  model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  temperature numeric(3,2) NOT NULL DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens integer NOT NULL DEFAULT 2048,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agents TO authenticated;
GRANT ALL ON public.ai_agents TO service_role;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_agents admin write" ON public.ai_agents FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "ai_agents read auth" ON public.ai_agents FOR SELECT TO authenticated USING (true);

-- ============ PROMPT TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  category text NOT NULL DEFAULT 'general',
  body text NOT NULL DEFAULT '',
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  current_version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompt_templates TO authenticated;
GRANT ALL ON public.ai_prompt_templates TO service_role;
ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompt_tpl admin" ON public.ai_prompt_templates FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "prompt_tpl read auth" ON public.ai_prompt_templates FOR SELECT TO authenticated USING (true);

-- ============ PROMPT VERSIONS ============
CREATE TABLE IF NOT EXISTS public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.ai_prompt_templates(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  changelog text,
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompt_versions TO authenticated;
GRANT ALL ON public.ai_prompt_versions TO service_role;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompt_ver admin" ON public.ai_prompt_versions FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ FEATURE TOGGLES ============
CREATE TABLE IF NOT EXISTS public.ai_feature_toggles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_feature_toggles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feature_toggles TO authenticated;
GRANT ALL ON public.ai_feature_toggles TO service_role;
ALTER TABLE public.ai_feature_toggles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "toggles public read" ON public.ai_feature_toggles FOR SELECT USING (true);
CREATE POLICY "toggles admin write" ON public.ai_feature_toggles FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ AI CAPABILITIES ============
CREATE TABLE IF NOT EXISTS public.ai_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  capability_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, capability_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_capabilities TO authenticated;
GRANT ALL ON public.ai_capabilities TO service_role;
ALTER TABLE public.ai_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caps admin" ON public.ai_capabilities FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "caps read auth" ON public.ai_capabilities FOR SELECT TO authenticated USING (true);

-- ============ USAGE LIMITS ============
CREATE TABLE IF NOT EXISTS public.ai_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope public.ai_limit_scope NOT NULL DEFAULT 'global',
  role public.app_role,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text,
  daily_limit integer,
  monthly_limit integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_limits TO authenticated;
GRANT ALL ON public.ai_usage_limits TO service_role;
ALTER TABLE public.ai_usage_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "limits admin" ON public.ai_usage_limits FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ USAGE LOGS ============
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  feature_key text NOT NULL,
  model text,
  tokens_in integer DEFAULT 0,
  tokens_out integer DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  latency_ms integer,
  status public.ai_usage_status NOT NULL DEFAULT 'success',
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;
GRANT ALL ON public.ai_usage_logs TO service_role;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage own read" ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "usage admin all" ON public.ai_usage_logs FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON public.ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature ON public.ai_usage_logs(feature_key, created_at DESC);

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_audit_logs TO authenticated;
GRANT ALL ON public.ai_audit_logs TO service_role;
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit admin" ON public.ai_audit_logs FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_ai_audit_created ON public.ai_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_entity ON public.ai_audit_logs(entity_type, entity_id);

-- ============ PDF TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  header_html text,
  footer_html text,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_size text NOT NULL DEFAULT 'A4',
  orientation text NOT NULL DEFAULT 'portrait',
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_templates TO authenticated;
GRANT ALL ON public.pdf_templates TO service_role;
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdf_tpl admin" ON public.pdf_templates FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "pdf_tpl read auth" ON public.pdf_templates FOR SELECT TO authenticated USING (true);

-- ============ GENERATED PDFS ============
CREATE TABLE IF NOT EXISTS public.generated_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.pdf_templates(id) ON DELETE SET NULL,
  story_id uuid,
  title text,
  url text,
  size_bytes integer,
  status text NOT NULL DEFAULT 'pending',
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.generated_pdfs TO authenticated;
GRANT ALL ON public.generated_pdfs TO service_role;
ALTER TABLE public.generated_pdfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdfs own" ON public.generated_pdfs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "pdfs admin all" ON public.generated_pdfs FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ VOICE PROFILES ============
CREATE TABLE IF NOT EXISTS public.audio_voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL DEFAULT 'openai',
  voice_id text NOT NULL,
  language text DEFAULT 'en',
  gender text,
  sample_url text,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audio_voice_profiles TO authenticated;
GRANT ALL ON public.audio_voice_profiles TO service_role;
ALTER TABLE public.audio_voice_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voices admin" ON public.audio_voice_profiles FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "voices read auth" ON public.audio_voice_profiles FOR SELECT TO authenticated USING (active = true OR public.has_role(auth.uid(),'admin'));

-- ============ GENERATED AUDIO ============
CREATE TABLE IF NOT EXISTS public.generated_audio_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voice_id uuid REFERENCES public.audio_voice_profiles(id) ON DELETE SET NULL,
  text_hash text,
  text_preview text,
  url text,
  duration_sec numeric(10,2),
  size_bytes integer,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.generated_audio_files TO authenticated;
GRANT ALL ON public.generated_audio_files TO service_role;
ALTER TABLE public.generated_audio_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audio own" ON public.generated_audio_files FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "audio admin all" ON public.generated_audio_files FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ RBAC PERMISSIONS ============
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_key text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_permissions TO authenticated;
GRANT ALL ON public.rbac_permissions TO service_role;
ALTER TABLE public.rbac_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rbac admin" ON public.rbac_permissions FOR ALL
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "rbac read auth" ON public.rbac_permissions FOR SELECT TO authenticated USING (true);

-- ============ TRIGGERS ============
CREATE TRIGGER trg_ai_agents_updated BEFORE UPDATE ON public.ai_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_prompt_tpl_updated BEFORE UPDATE ON public.ai_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_toggles_updated BEFORE UPDATE ON public.ai_feature_toggles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ai_limits_updated BEFORE UPDATE ON public.ai_usage_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pdf_tpl_updated BEFORE UPDATE ON public.pdf_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_voice_updated BEFORE UPDATE ON public.audio_voice_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HELPER RPC: check permission ============
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.rbac_permissions p ON p.role = ur.role
    WHERE ur.user_id = _user_id AND p.permission_key = _permission AND p.granted = true
  ) OR public.has_role(_user_id, 'admin');
$$;

-- ============ SEEDS ============
INSERT INTO public.ai_feature_toggles (feature_key, label, description, enabled) VALUES
  ('pdf_generation','PDF Generation','Allow exporting stories and content as PDF', true),
  ('audio_generation','AI Audio (TTS)','Allow text-to-speech narration', true),
  ('file_downloads','File Downloads','Allow downloading generated files', true),
  ('image_generation','AI Image Generation','Allow AI illustrations', true),
  ('ai_chat','AI Chat','Enable the AI assistant chat', true),
  ('ai_summaries','AI Summaries','Allow AI-generated summaries', true),
  ('ai_translation','AI Translation','Allow AI translation features', true),
  ('ai_writing','AI Content Writing','Allow AI story/content writing', true)
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.ai_agents (name, slug, description, system_prompt, tone, is_default, active) VALUES
  ('Najma Storyteller','najma-storyteller',
   'Default friendly storyteller persona for the children''s platform.',
   'You are Najma, a warm and encouraging storyteller for children. Always be safe, age-appropriate, educational, and emotionally supportive.',
   'friendly', true, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.rbac_permissions (role, permission_key) VALUES
  ('admin','manage_ai_settings'),
  ('admin','manage_prompts'),
  ('admin','generate_pdfs'),
  ('admin','generate_audio'),
  ('admin','view_analytics'),
  ('admin','manage_users'),
  ('admin','manage_rbac'),
  ('admin','view_audit_logs')
ON CONFLICT (role, permission_key) DO NOTHING;
