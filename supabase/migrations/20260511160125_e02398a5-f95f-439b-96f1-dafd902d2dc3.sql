-- 1. payment_settings: admin-only read
DROP POLICY IF EXISTS "Authenticated reads payment settings" ON public.payment_settings;

-- 2. payment-proofs: drop duplicate public-scoped policies
DROP POLICY IF EXISTS "Users upload own proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users view own proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own proofs" ON storage.objects;

-- Re-add owner-scoped DELETE for payment proofs (authenticated only)
CREATE POLICY "Users delete own payment proofs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 3. reading_streaks: explicit owner-scoped DELETE
DROP POLICY IF EXISTS "Users delete own reading streaks" ON public.reading_streaks;
CREATE POLICY "Users delete own reading streaks"
  ON public.reading_streaks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. contact_messages: tighter INSERT policy
DROP POLICY IF EXISTS "Anyone submits contact message" ON public.contact_messages;
CREATE POLICY "Anyone submits contact message"
  ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    name IS NOT NULL AND char_length(name) BETWEEN 1 AND 100
    AND email IS NOT NULL AND char_length(email) BETWEEN 3 AND 255
    AND message IS NOT NULL AND char_length(message) BETWEEN 1 AND 2000
  );

-- 5. Public buckets: remove broad listing; rely on bucket public flag for direct URL reads
DROP POLICY IF EXISTS "Public read story images" ON storage.objects;
DROP POLICY IF EXISTS "Public read story audio" ON storage.objects;
DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Story PDFs are publicly readable" ON storage.objects;

-- 6. Lock down SECURITY DEFINER helpers (still callable inside RLS as table owner)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) TO service_role;