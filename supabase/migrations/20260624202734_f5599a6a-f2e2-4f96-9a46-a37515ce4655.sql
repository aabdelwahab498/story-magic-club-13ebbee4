
ALTER TABLE public.download_settings
  ADD COLUMN IF NOT EXISTS alerts_email_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alerts_slack_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_email TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS last_alert_signature TEXT,
  ADD COLUMN IF NOT EXISTS last_alert_sent_at TIMESTAMPTZ;
