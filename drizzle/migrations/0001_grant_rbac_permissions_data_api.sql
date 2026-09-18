-- rbac_permissions has RLS enabled with admin-only policies but no table-level
-- privileges were ever granted, so every Data API / PostgREST call failed with
-- "permission denied for table rbac_permissions" before RLS was even evaluated.
-- Grants alone are not access: the existing has_role(auth.uid(),'admin') policies
-- still gate every row for read and write.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rbac_permissions TO authenticated;
GRANT ALL ON public.rbac_permissions TO service_role;
-- No anon grant: anonymous users must stay locked out entirely.
