
CREATE TABLE public.n8n_integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_base_url text,
  webhook_secret_set boolean NOT NULL DEFAULT false,
  txt_enabled boolean NOT NULL DEFAULT true,
  mp3_enabled boolean NOT NULL DEFAULT true,
  pdf_enabled boolean NOT NULL DEFAULT true,
  txt_path text NOT NULL DEFAULT '/export-txt',
  mp3_path text NOT NULL DEFAULT '/export-audio',
  pdf_path text NOT NULL DEFAULT '/export-pdf',
  last_tested_at timestamptz,
  last_test_status text,
  last_test_message text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.n8n_integration_settings TO authenticated;
GRANT ALL ON public.n8n_integration_settings TO service_role;

ALTER TABLE public.n8n_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view n8n settings"
  ON public.n8n_integration_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert n8n settings"
  ON public.n8n_integration_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update n8n settings"
  ON public.n8n_integration_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_n8n_settings_updated_at
  BEFORE UPDATE ON public.n8n_integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed single row
INSERT INTO public.n8n_integration_settings (id) VALUES (gen_random_uuid());

-- Private key/value table for the webhook secret. NO RLS grants to authenticated;
-- only service_role (edge functions) can read/write it.
CREATE TABLE public.n8n_integration_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.n8n_integration_secrets TO service_role;

ALTER TABLE public.n8n_integration_secrets ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon => fully locked to service_role only.
