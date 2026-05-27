-- Create public storage buckets for story images and audio
INSERT INTO storage.buckets (id, name, public)
VALUES ('story-images', 'story-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('story-audio', 'story-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Story images policies (drop if exists then recreate, idempotent)
DROP POLICY IF EXISTS "Public read story images" ON storage.objects;
CREATE POLICY "Public read story images"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-images');

DROP POLICY IF EXISTS "Staff upload story images" ON storage.objects;
CREATE POLICY "Staff upload story images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'story-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
);

DROP POLICY IF EXISTS "Staff update story images" ON storage.objects;
CREATE POLICY "Staff update story images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'story-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
);

DROP POLICY IF EXISTS "Admins delete story images" ON storage.objects;
CREATE POLICY "Admins delete story images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'story-images'
  AND public.has_role(auth.uid(), 'admin')
);

-- Story audio policies
DROP POLICY IF EXISTS "Public read story audio" ON storage.objects;
CREATE POLICY "Public read story audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-audio');

DROP POLICY IF EXISTS "Staff upload story audio" ON storage.objects;
CREATE POLICY "Staff upload story audio"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'story-audio'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
);

DROP POLICY IF EXISTS "Staff update story audio" ON storage.objects;
CREATE POLICY "Staff update story audio"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'story-audio'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
);

DROP POLICY IF EXISTS "Admins delete story audio" ON storage.objects;
CREATE POLICY "Admins delete story audio"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'story-audio'
  AND public.has_role(auth.uid(), 'admin')
);
