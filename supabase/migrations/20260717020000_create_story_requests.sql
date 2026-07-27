-- Create an enum for story lifecycle status
CREATE TYPE story_status AS ENUM (
  'draft',
  'queued',
  'generating',
  'generated',
  'illustrating',
  'narrating',
  'completed',
  'failed'
);

-- Create the story_requests table
CREATE TABLE IF NOT EXISTS story_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  status story_status NOT NULL DEFAULT 'draft',
  language TEXT NOT NULL DEFAULT 'en',
  reading_level TEXT NOT NULL,
  theme TEXT NOT NULL,
  sel_goal TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 5,
  estimated_reading_time INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE story_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own story requests"
  ON story_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own story requests"
  ON story_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own story requests"
  ON story_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own story requests"
  ON story_requests FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON story_requests
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
