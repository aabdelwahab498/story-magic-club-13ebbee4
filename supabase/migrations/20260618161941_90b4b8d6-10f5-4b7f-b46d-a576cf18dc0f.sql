CREATE POLICY "Users read their own epub files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'story-epubs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read their own bundle files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'story-bundles' AND (storage.foldername(name))[1] = auth.uid()::text);