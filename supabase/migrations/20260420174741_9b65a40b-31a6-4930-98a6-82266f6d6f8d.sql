
-- Stories: extra fields
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_url text;

-- Editors can create/update story drafts
DROP POLICY IF EXISTS "Editors create stories" ON public.stories;
CREATE POLICY "Editors create stories"
ON public.stories
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'editor'));

DROP POLICY IF EXISTS "Editors update stories" ON public.stories;
CREATE POLICY "Editors update stories"
ON public.stories
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'editor'))
WITH CHECK (public.has_role(auth.uid(), 'editor') AND published = false);

-- Videos table
CREATE TABLE IF NOT EXISTS public.videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title jsonb NOT NULL DEFAULT '{}'::jsonb,
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  thumbnail text,
  video_url text,
  source_type text NOT NULL DEFAULT 'url' CHECK (source_type IN ('url','upload')),
  age_range text,
  category text,
  duration text,
  views integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads published videos" ON public.videos;
CREATE POLICY "Anyone reads published videos"
ON public.videos
FOR SELECT
USING (published = true OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

DROP POLICY IF EXISTS "Admins manage videos" ON public.videos;
CREATE POLICY "Admins manage videos"
ON public.videos
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Editors create videos" ON public.videos;
CREATE POLICY "Editors create videos"
ON public.videos
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'editor'));

DROP POLICY IF EXISTS "Editors update videos" ON public.videos;
CREATE POLICY "Editors update videos"
ON public.videos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'editor'))
WITH CHECK (public.has_role(auth.uid(), 'editor') AND published = false);

DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
CREATE TRIGGER trg_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-thumbnails', 'video-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('video-uploads', 'video-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
CREATE POLICY "Public read thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'video-thumbnails');

DROP POLICY IF EXISTS "Staff upload thumbnails" ON storage.objects;
CREATE POLICY "Staff upload thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'video-thumbnails'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
);

DROP POLICY IF EXISTS "Staff update thumbnails" ON storage.objects;
CREATE POLICY "Staff update thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'video-thumbnails'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
);

DROP POLICY IF EXISTS "Admins delete thumbnails" ON storage.objects;
CREATE POLICY "Admins delete thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'video-thumbnails' AND public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Staff read uploads" ON storage.objects;
CREATE POLICY "Staff read uploads"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'video-uploads'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
);

DROP POLICY IF EXISTS "Staff upload videos" ON storage.objects;
CREATE POLICY "Staff upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'video-uploads'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
);

DROP POLICY IF EXISTS "Admins delete uploads" ON storage.objects;
CREATE POLICY "Admins delete uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'video-uploads' AND public.has_role(auth.uid(),'admin'));
