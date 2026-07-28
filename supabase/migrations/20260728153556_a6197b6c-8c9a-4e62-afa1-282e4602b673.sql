-- payment_settings: admins only
DROP POLICY IF EXISTS "Authenticated reads payment settings" ON public.payment_settings;
DROP POLICY IF EXISTS "Admins read payment settings" ON public.payment_settings;
CREATE POLICY "Admins read payment settings" ON public.payment_settings
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.payment_settings FROM anon;

-- rbac_permissions: admins only
DROP POLICY IF EXISTS "rbac read auth" ON public.rbac_permissions;
DROP POLICY IF EXISTS "Admins read rbac permissions" ON public.rbac_permissions;
CREATE POLICY "Admins read rbac permissions" ON public.rbac_permissions
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
REVOKE SELECT ON public.rbac_permissions FROM anon;

-- ai_feature_toggles: authenticated only
DROP POLICY IF EXISTS "toggles public read" ON public.ai_feature_toggles;
DROP POLICY IF EXISTS "Authenticated read feature toggles" ON public.ai_feature_toggles;
CREATE POLICY "Authenticated read feature toggles" ON public.ai_feature_toggles
FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.ai_feature_toggles FROM anon;

-- download_settings: authenticated only
DROP POLICY IF EXISTS "Anyone can view download settings" ON public.download_settings;
DROP POLICY IF EXISTS "Authenticated read download settings" ON public.download_settings;
CREATE POLICY "Authenticated read download settings" ON public.download_settings
FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.download_settings FROM anon;
