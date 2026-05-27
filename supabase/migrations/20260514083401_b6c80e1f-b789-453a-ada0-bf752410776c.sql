-- Tighten SECURITY DEFINER perms on the upload pipeline functions
REVOKE EXECUTE ON FUNCTION public.user_daily_upload_bytes(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_upload_pipeline() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.user_daily_upload_bytes(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_upload_pipeline() TO service_role;