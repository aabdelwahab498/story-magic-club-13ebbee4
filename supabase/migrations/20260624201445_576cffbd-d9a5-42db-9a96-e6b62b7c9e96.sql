
CREATE TABLE public.download_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  enable_pdf BOOLEAN NOT NULL DEFAULT TRUE,
  enable_mp3 BOOLEAN NOT NULL DEFAULT TRUE,
  enable_txt BOOLEAN NOT NULL DEFAULT TRUE,
  enable_docx BOOLEAN NOT NULL DEFAULT TRUE,
  enable_epub BOOLEAN NOT NULL DEFAULT TRUE,
  enable_images BOOLEAN NOT NULL DEFAULT TRUE,
  enable_pack BOOLEAN NOT NULL DEFAULT TRUE,
  daily_limit_per_user INTEGER NOT NULL DEFAULT 50,
  max_file_size_mb INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT download_settings_singleton CHECK (id = TRUE)
);

GRANT SELECT ON public.download_settings TO authenticated, anon;
GRANT ALL ON public.download_settings TO service_role;

ALTER TABLE public.download_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view download settings"
  ON public.download_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can insert download settings"
  ON public.download_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update download settings"
  ON public.download_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_download_settings_updated_at
  BEFORE UPDATE ON public.download_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.download_settings (id) VALUES (TRUE) ON CONFLICT DO NOTHING;
