
CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_log_created_idx ON public.email_delivery_log(created_at DESC);
CREATE INDEX IF NOT EXISTS email_delivery_log_template_idx ON public.email_delivery_log(template);

GRANT SELECT ON public.email_delivery_log TO authenticated;
GRANT ALL ON public.email_delivery_log TO service_role;

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view email log"
  ON public.email_delivery_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
