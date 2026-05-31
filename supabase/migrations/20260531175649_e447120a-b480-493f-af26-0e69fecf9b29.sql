
-- 1) Extend subscription_plans with Paddle price mapping
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS paddle_price_id TEXT,
  ADD COLUMN IF NOT EXISTS paddle_product_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_plans_paddle_price_id_uidx
  ON public.subscription_plans (paddle_price_id)
  WHERE paddle_price_id IS NOT NULL;

-- 2) Paddle subscriptions table
CREATE TABLE IF NOT EXISTS public.paddle_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  paddle_subscription_id TEXT NOT NULL UNIQUE,
  paddle_customer_id TEXT,
  paddle_price_id TEXT,
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paddle_subscriptions_user_idx
  ON public.paddle_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS paddle_subscriptions_status_idx
  ON public.paddle_subscriptions(status);

GRANT SELECT ON public.paddle_subscriptions TO authenticated;
GRANT ALL    ON public.paddle_subscriptions TO service_role;

ALTER TABLE public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own paddle sub"
ON public.paddle_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all paddle subs"
ON public.paddle_subscriptions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER paddle_subscriptions_updated_at
BEFORE UPDATE ON public.paddle_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Webhook events (idempotency + audit)
CREATE TABLE IF NOT EXISTS public.paddle_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.paddle_webhook_events TO service_role;

ALTER TABLE public.paddle_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view webhook events"
ON public.paddle_webhook_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 4) Helper used by quota
CREATE OR REPLACE FUNCTION public.get_active_paddle_tier(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tier
    FROM public.paddle_subscriptions
   WHERE user_id = _user_id
     AND status IN ('active','trialing')
     AND (current_period_end IS NULL OR current_period_end > now())
   ORDER BY updated_at DESC
   LIMIT 1;
$$;
