-- Migration: Fix RLS policies for story_media table
-- Enables authenticated users to insert and update story_media rows for stories they own.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_media' AND policyname = 'Users can insert their own story media') THEN
        CREATE POLICY "Users can insert their own story media" ON public.story_media FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.story_requests 
                WHERE story_requests.id = story_media.story_id 
                AND story_requests.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.ai_story_history 
                WHERE ai_story_history.id = story_media.story_id 
                AND ai_story_history.user_id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_media' AND policyname = 'Users can update their own story media') THEN
        CREATE POLICY "Users can update their own story media" ON public.story_media FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.story_requests 
                WHERE story_requests.id = story_media.story_id 
                AND story_requests.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.ai_story_history 
                WHERE ai_story_history.id = story_media.story_id 
                AND ai_story_history.user_id = auth.uid()
            )
        );
    END IF;
END $$;
