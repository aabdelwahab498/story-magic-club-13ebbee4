-- Add authenticated-owner INSERT and UPDATE policies to story_media.
-- Ownership is resolved through the parent story row (story_requests or ai_story_history),
-- matching the existing SELECT policy. RLS stays enabled; no anon grants.

GRANT INSERT, UPDATE ON public.story_media TO authenticated;
GRANT ALL ON public.story_media TO service_role;

CREATE POLICY "Users can insert their own story media"
ON public.story_media
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM story_requests
    WHERE story_requests.id = story_media.story_id
      AND story_requests.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ai_story_history
    WHERE ai_story_history.id = story_media.story_id
      AND ai_story_history.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own story media"
ON public.story_media
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM story_requests
    WHERE story_requests.id = story_media.story_id
      AND story_requests.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ai_story_history
    WHERE ai_story_history.id = story_media.story_id
      AND ai_story_history.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM story_requests
    WHERE story_requests.id = story_media.story_id
      AND story_requests.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM ai_story_history
    WHERE ai_story_history.id = story_media.story_id
      AND ai_story_history.user_id = auth.uid()
  )
);