ALTER TABLE public.illustration_job_events
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.illustration_job_events.details IS 'Sanitized structured diagnostics for provider, storage, persistence, and credit lifecycle events.';

DROP POLICY IF EXISTS "Admins view all generated illustrations" ON public.generated_illustrations;
CREATE POLICY "Admins view all generated illustrations"
ON public.generated_illustrations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.generated_illustrations TO authenticated;
GRANT ALL ON public.generated_illustrations TO service_role;
GRANT SELECT ON public.illustration_job_events TO authenticated;
GRANT ALL ON public.illustration_job_events TO service_role;