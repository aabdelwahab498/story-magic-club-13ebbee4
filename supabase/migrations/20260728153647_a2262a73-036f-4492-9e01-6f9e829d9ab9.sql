DROP POLICY IF EXISTS "ai agents read auth" ON public.ai_agents;
DROP POLICY IF EXISTS "Authenticated read ai agents" ON public.ai_agents;
DROP POLICY IF EXISTS "ai_agents_select_authenticated" ON public.ai_agents;
DROP POLICY IF EXISTS "Staff read ai agents" ON public.ai_agents;
CREATE POLICY "Staff read ai agents" ON public.ai_agents
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
REVOKE SELECT ON public.ai_agents FROM anon;

DROP POLICY IF EXISTS "prompt templates read auth" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Authenticated read prompt templates" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "ai_prompt_templates_select_authenticated" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "Staff read prompt templates" ON public.ai_prompt_templates;
CREATE POLICY "Staff read prompt templates" ON public.ai_prompt_templates
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));
REVOKE SELECT ON public.ai_prompt_templates FROM anon;
