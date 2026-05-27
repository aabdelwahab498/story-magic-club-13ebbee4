-- Add gallery column to stories for chapter images
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS gallery jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Populate gallery for Luma & Nova story with the 9 chapter images
UPDATE public.stories
SET gallery = jsonb_build_array(
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p2.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p3.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p4.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p5.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p6.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p7.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p8.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p9.jpg',
  'https://pkpervvletmxkvkwactk.supabase.co/storage/v1/object/public/story-images/luma-nova/p10.jpg'
)
WHERE id = '78d2e171-84f0-4314-a753-50fc6d930c04';