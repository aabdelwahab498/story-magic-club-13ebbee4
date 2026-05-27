-- Restore EXECUTE on SECURITY DEFINER role-check functions to anon/authenticated.
-- These are used inside RLS policies (e.g. "Anyone reads active products"),
-- so revoking EXECUTE breaks public reads even though the function itself is safe.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) TO anon, authenticated;