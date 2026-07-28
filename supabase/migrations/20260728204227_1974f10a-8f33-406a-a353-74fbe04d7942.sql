-- 1) Revoke everything from anon/authenticated on all public SECURITY DEFINER functions
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', r.sig);
  END LOOP;
END $$;

-- 2) Re-grant only what the client legitimately needs
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_story_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_paddle_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_daily_upload_bytes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_manual_payment(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_manual_payment(uuid, text) TO authenticated;

-- Registration gate is needed before sign-in
GRANT EXECUTE ON FUNCTION public.registration_allowed() TO anon, authenticated;
