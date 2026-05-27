
-- 1) story_generation_settings: restrict reads to admins only
DROP POLICY IF EXISTS "Anyone reads story settings" ON public.story_generation_settings;

-- (Admins manage policy already exists, covers SELECT/INSERT/UPDATE/DELETE.)

-- 2) Storage: remove broad public listing + open insert on story-music
DROP POLICY IF EXISTS "Public read story music" ON storage.objects;
DROP POLICY IF EXISTS "Service writes story music" ON storage.objects;
-- The bucket is public so direct file URLs still work; service_role bypasses RLS for inserts.

-- 3) Lock down SECURITY DEFINER trigger functions (not meant to be callable by clients)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_manual_payment_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_manual_payment_immutable_fields() FROM PUBLIC, anon, authenticated;

-- has_role and has_paid_feature must remain callable (used inside RLS policies),
-- but only by signed-in users — revoke from anon where safe.
REVOKE EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) TO authenticated;
