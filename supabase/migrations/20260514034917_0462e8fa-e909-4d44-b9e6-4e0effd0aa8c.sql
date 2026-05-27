
-- 1. Audit log for claim-admin attempts
CREATE TABLE IF NOT EXISTS public.admin_claim_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  success boolean NOT NULL DEFAULT false,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_claim_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view claim attempts"
  ON public.admin_claim_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_admin_claim_attempts_created
  ON public.admin_claim_attempts (created_at DESC);

-- 2. Prevent duplicate votes per (user, drawing)
DELETE FROM public.drawing_votes a
USING public.drawing_votes b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.drawing_id = b.drawing_id;

ALTER TABLE public.drawing_votes
  ADD CONSTRAINT drawing_votes_user_drawing_unique
  UNIQUE (user_id, drawing_id);

-- 3. Tighten public storage buckets
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id IN ('story-images','video-thumbnails');

UPDATE storage.buckets
SET file_size_limit = 31457280,
    allowed_mime_types = ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/webm','audio/ogg','audio/mp4']
WHERE id = 'story-audio';

UPDATE storage.buckets
SET file_size_limit = 31457280,
    allowed_mime_types = ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/webm','audio/ogg','audio/mp4']
WHERE id = 'story-music';

UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'story-pdfs';

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id = 'payment-proofs';

UPDATE storage.buckets
SET file_size_limit = 524288000,
    allowed_mime_types = ARRAY['video/mp4','video/webm','video/quicktime']
WHERE id = 'video-uploads';
