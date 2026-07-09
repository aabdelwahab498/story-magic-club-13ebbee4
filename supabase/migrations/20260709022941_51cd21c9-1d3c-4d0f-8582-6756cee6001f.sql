
-- Users can read their own files (first path segment = user id)
CREATE POLICY "story-exports read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'story-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "story-exports insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'story-exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "story-exports delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'story-exports' AND auth.uid()::text = (storage.foldername(name))[1]);
