-- Align rbac_permissions policies with the admin guard, which treats
-- super_admin as an admin role. Previously only 'admin' was accepted, so
-- super_admins reached the page but were rejected by the database.

DROP POLICY IF EXISTS "Admins read rbac permissions" ON public.rbac_permissions;
CREATE POLICY "Admins read rbac permissions" ON public.rbac_permissions
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);

DROP POLICY IF EXISTS "rbac admin" ON public.rbac_permissions;
CREATE POLICY "rbac admin" ON public.rbac_permissions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_permissions TO authenticated;
GRANT ALL ON public.rbac_permissions TO service_role;
