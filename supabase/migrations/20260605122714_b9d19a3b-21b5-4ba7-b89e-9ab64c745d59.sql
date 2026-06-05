
-- 1. Insert Growth + Pro plans (idempotent)
INSERT INTO public.subscription_plans (
  tier, name, description, price_usd, price_egp,
  monthly_story_limit, daily_story_limit, illustration_credits, credits_reset_monthly,
  allow_illustrations, allow_pdf, allow_audio,
  features, active, sort_order
) VALUES
(
  'growth',
  '{"en":"Growth","ar":"النمو"}'::jsonb,
  '{"en":"Higher credits, priority processing, premium templates","ar":"رصيد أعلى ومعالجة بأولوية وقوالب مميزة"}'::jsonb,
  19, 950,
  100, 15, 250, true,
  true, true, true,
  '[
    {"en":"100 stories/month","ar":"100 قصة شهرياً"},
    {"en":"Priority processing","ar":"معالجة بأولوية"},
    {"en":"Premium story templates","ar":"قوالب قصص مميزة"},
    {"en":"Extended content generation","ar":"حدود توليد موسعة"}
  ]'::jsonb,
  true, 2
),
(
  'pro',
  '{"en":"Pro","ar":"احترافي"}'::jsonb,
  '{"en":"Unlimited credits, highest priority, premium support","ar":"رصيد غير محدود، أعلى أولوية، دعم مميز"}'::jsonb,
  39, 1950,
  999, 100, 9999, true,
  true, true, true,
  '[
    {"en":"Unlimited stories","ar":"قصص غير محدودة"},
    {"en":"Highest priority processing","ar":"أعلى أولوية في المعالجة"},
    {"en":"All premium features","ar":"جميع الميزات المميزة"},
    {"en":"Premium support","ar":"دعم مميز"},
    {"en":"Advanced customization","ar":"تخصيص متقدم"}
  ]'::jsonb,
  true, 3
)
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_usd = EXCLUDED.price_usd,
  price_egp = EXCLUDED.price_egp,
  monthly_story_limit = EXCLUDED.monthly_story_limit,
  daily_story_limit = EXCLUDED.daily_story_limit,
  illustration_credits = EXCLUDED.illustration_credits,
  features = EXCLUDED.features,
  active = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 2. Paddle transactions log
CREATE TABLE IF NOT EXISTS public.paddle_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  paddle_transaction_id text UNIQUE,
  paddle_subscription_id text,
  paddle_customer_id text,
  paddle_price_id text,
  tier text,
  event_type text NOT NULL,
  status text,
  amount_cents bigint,
  currency text,
  occurred_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS paddle_transactions_user_idx ON public.paddle_transactions(user_id);
CREATE INDEX IF NOT EXISTS paddle_transactions_created_idx ON public.paddle_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS paddle_transactions_type_idx ON public.paddle_transactions(event_type);

GRANT SELECT ON public.paddle_transactions TO authenticated;
GRANT ALL ON public.paddle_transactions TO service_role;

ALTER TABLE public.paddle_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own paddle transactions"
  ON public.paddle_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all paddle transactions"
  ON public.paddle_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
