
-- Bucket for downloadable story PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-pdfs', 'story-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Story PDFs are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-pdfs');

-- Authenticated users can manage PDFs in their own user folder
CREATE POLICY "Users upload own story PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'story-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own story PDFs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'story-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own story PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'story-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Track latest PDF on the story row
ALTER TABLE public.ai_story_history
  ADD COLUMN IF NOT EXISTS pdf_url text;
