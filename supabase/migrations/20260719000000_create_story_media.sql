-- Create enum for media types
CREATE TYPE media_type AS ENUM ('ILLUSTRATION', 'AUDIO', 'PDF');

-- Create enum for media status
CREATE TYPE media_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- Create story_media table
CREATE TABLE story_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    type media_type NOT NULL,
    provider TEXT NOT NULL,
    status media_status NOT NULL DEFAULT 'PENDING',
    url TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying media by story
CREATE INDEX idx_story_media_story_id ON story_media(story_id);

-- Enable RLS
ALTER TABLE story_media ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view media for their own stories
CREATE POLICY "Users can view their own story media" 
ON story_media FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM stories 
        WHERE stories.id = story_media.story_id 
        AND stories.user_id = auth.uid()
    )
);

-- Policy: Admins can do anything
CREATE POLICY "Admins have full access to story_media" 
ON story_media FOR ALL 
USING (has_role('admin'));
