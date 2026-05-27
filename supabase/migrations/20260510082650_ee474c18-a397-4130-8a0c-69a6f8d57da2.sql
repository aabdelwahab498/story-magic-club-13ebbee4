-- 1) Lock payment_settings to authenticated users only
DROP POLICY IF EXISTS "Anyone reads payment settings" ON public.payment_settings;
CREATE POLICY "Authenticated reads payment settings"
  ON public.payment_settings FOR SELECT
  TO authenticated
  USING (true);

-- 2) drawing_votes: users only see their own vote rows
DROP POLICY IF EXISTS "Anyone reads votes" ON public.drawing_votes;
CREATE POLICY "Users view own vote"
  ON public.drawing_votes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3) Revoke EXECUTE on internal trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_drawing_vote_count() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;