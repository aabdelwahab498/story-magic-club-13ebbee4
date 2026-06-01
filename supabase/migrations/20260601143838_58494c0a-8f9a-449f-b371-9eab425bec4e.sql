
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_status text NOT NULL DEFAULT 'not_shipped',
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_carrier text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

CREATE TABLE IF NOT EXISTS public.order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event text NOT NULL,
  channel text NOT NULL,
  recipient text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

GRANT SELECT ON public.order_notifications TO authenticated;
GRANT ALL ON public.order_notifications TO service_role;

ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notifications"
  ON public.order_notifications
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own notifications"
  ON public.order_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS order_notifications_order_idx ON public.order_notifications(order_id);
CREATE INDEX IF NOT EXISTS paddle_webhook_events_type_idx ON public.paddle_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS paddle_webhook_events_created_idx ON public.paddle_webhook_events(created_at DESC);
