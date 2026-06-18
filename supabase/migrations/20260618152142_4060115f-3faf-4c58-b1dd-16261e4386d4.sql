
-- Harden ai_audit_logs RLS: admins OR users with view_audit_logs permission can read; only admins can write
DROP POLICY IF EXISTS "audit admin" ON public.ai_audit_logs;

CREATE POLICY "audit read by permission"
  ON public.ai_audit_logs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_permission(auth.uid(), 'view_audit_logs')
  );

CREATE POLICY "audit write admin only"
  ON public.ai_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit update admin only"
  ON public.ai_audit_logs FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "audit delete admin only"
  ON public.ai_audit_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed additional fine-grained permissions used by the sidebar
INSERT INTO public.rbac_permissions (role, permission_key) VALUES
  ('admin','manage_stories'),
  ('admin','manage_videos'),
  ('admin','manage_blog'),
  ('admin','manage_products'),
  ('admin','manage_orders'),
  ('admin','manage_payments'),
  ('admin','manage_settings'),
  ('admin','manage_voices'),
  ('admin','manage_pdf_templates'),
  ('admin','manage_feature_toggles'),
  ('admin','manage_usage_limits'),
  ('admin','manage_agents'),
  ('editor','manage_stories'),
  ('editor','manage_blog'),
  ('editor','manage_prompts'),
  ('editor','view_analytics'),
  ('editor','view_audit_logs')
ON CONFLICT (role, permission_key) DO NOTHING;
