-- payment_settings: signed-in users need to read instructions to pay
DROP POLICY IF EXISTS "Authenticated reads payment settings" ON public.payment_settings;
CREATE POLICY "Authenticated reads payment settings"
  ON public.payment_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- story_music_cache: tighten public read to authenticated only
DROP POLICY IF EXISTS "Anyone reads music cache" ON public.story_music_cache;
CREATE POLICY "Authenticated reads music cache"
  ON public.story_music_cache
  FOR SELECT
  TO authenticated
  USING (true);