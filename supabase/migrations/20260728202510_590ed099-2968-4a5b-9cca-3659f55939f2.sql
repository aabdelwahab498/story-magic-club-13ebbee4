DROP POLICY IF EXISTS "ai_agents read auth" ON public.ai_agents;
DROP POLICY IF EXISTS "caps read auth" ON public.ai_capabilities;
DROP POLICY IF EXISTS "prompt_tpl read auth" ON public.ai_prompt_templates;

CREATE POLICY "Admins read ai capabilities" ON public.ai_capabilities
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));