DROP VIEW IF EXISTS public.site_stats;
CREATE VIEW public.site_stats WITH (security_invoker = true) AS
SELECT
  (SELECT COUNT(*) FROM public.stories WHERE published = true) AS total_stories,
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  (SELECT COUNT(*) FROM public.drawing_entries WHERE approved = true) AS total_drawings;
GRANT SELECT ON public.site_stats TO anon, authenticated;