-- Allow authenticated users to submit blog posts for admin review
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS submission_status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Backfill existing rows: any existing posts authored by editors/admins are 'approved'
UPDATE public.blog_posts SET submission_status = 'approved' WHERE submission_status IS NULL;

-- Authors can submit (pending, unpublished, owned by themselves)
CREATE POLICY "Authors submit blog posts"
ON public.blog_posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND submission_status = 'pending'
  AND published = false
);

-- Authors view their own submissions (pending/rejected/approved)
CREATE POLICY "Authors view own submissions"
ON public.blog_posts
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Authors can edit their own pending submissions only (cannot publish themselves)
CREATE POLICY "Authors update own pending submissions"
ON public.blog_posts
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by AND submission_status = 'pending')
WITH CHECK (
  auth.uid() = created_by
  AND submission_status = 'pending'
  AND published = false
);

-- Authors can delete their own pending submissions
CREATE POLICY "Authors delete own pending submissions"
ON public.blog_posts
FOR DELETE
TO authenticated
USING (auth.uid() = created_by AND submission_status = 'pending');

-- Tighten public read: only show approved + published to anonymous
DROP POLICY IF EXISTS "Anyone reads published blog posts" ON public.blog_posts;
CREATE POLICY "Anyone reads published blog posts"
ON public.blog_posts
FOR SELECT
USING (
  (published = true AND submission_status = 'approved')
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'editor'::app_role)
);
