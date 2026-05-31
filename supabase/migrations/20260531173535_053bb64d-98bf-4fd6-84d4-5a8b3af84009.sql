
-- =========================================================================
-- 1. APP SETTINGS (singleton)
-- =========================================================================
CREATE TABLE public.app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  allow_free_registrations BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins update app settings" ON public.app_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert app settings" ON public.app_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (id, allow_free_registrations) VALUES (true, true);

-- =========================================================================
-- 2. WAITLIST
-- =========================================================================
CREATE TABLE public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  source TEXT DEFAULT 'registration_closed',
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX waitlist_email_unique ON public.waitlist (lower(email));

GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone joins waitlist" ON public.waitlist FOR INSERT
  WITH CHECK (
    email IS NOT NULL
    AND char_length(email) BETWEEN 3 AND 255
    AND (name IS NULL OR char_length(name) <= 100)
  );
CREATE POLICY "Admins view waitlist" ON public.waitlist FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage waitlist" ON public.waitlist FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete waitlist" ON public.waitlist FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================================
-- 3. VISIBILITY on ai_story_history
-- =========================================================================
ALTER TABLE public.ai_story_history
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS idx_ai_story_history_public
  ON public.ai_story_history (created_at DESC) WHERE visibility = 'public';

-- Public read access for community library
CREATE POLICY "Anyone reads public AI stories"
  ON public.ai_story_history FOR SELECT
  USING (visibility = 'public');

-- =========================================================================
-- 4. ILLUSTRATION CREDITS
-- =========================================================================
CREATE TABLE public.illustration_credits (
  user_id UUID PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0,
  monthly_allocation INT NOT NULL DEFAULT 0,
  lifetime_only BOOLEAN NOT NULL DEFAULT true,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.illustration_credits TO authenticated;
GRANT ALL ON public.illustration_credits TO service_role;

ALTER TABLE public.illustration_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credits" ON public.illustration_credits FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all credits" ON public.illustration_credits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage credits" ON public.illustration_credits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_illustration_credits_updated_at
  BEFORE UPDATE ON public.illustration_credits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 5. PLAN COLUMNS for new model
-- =========================================================================
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS daily_story_limit INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS illustration_credits INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_monthly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_byok BOOLEAN NOT NULL DEFAULT false;

-- Seed/update plan rows (tier names follow existing schema).
INSERT INTO public.subscription_plans (tier, name, description, price_egp, price_usd,
  monthly_story_limit, daily_story_limit, illustration_credits, credits_reset_monthly,
  allow_byok, allow_illustrations, allow_audio, allow_pdf, active, sort_order)
VALUES
  ('free', '{"en":"Free","ar":"مجاني"}'::jsonb, '{"en":"Fair-use free tier"}'::jsonb,
    0, 0, 30, 3, 20, false, false, true, true, true, true, 0)
ON CONFLICT (tier) DO UPDATE SET
  monthly_story_limit = 30, daily_story_limit = 3,
  illustration_credits = 20, credits_reset_monthly = false,
  allow_byok = false, allow_illustrations = true;

INSERT INTO public.subscription_plans (tier, name, description, price_egp, price_usd,
  monthly_story_limit, daily_story_limit, illustration_credits, credits_reset_monthly,
  allow_byok, allow_illustrations, allow_audio, allow_pdf, active, sort_order)
VALUES
  ('parent', '{"en":"Parent","ar":"الوالد"}'::jsonb, '{"en":"Family-friendly tier"}'::jsonb,
    450, 9, 210, 7, 80, true, false, true, true, true, true, 1)
ON CONFLICT (tier) DO UPDATE SET
  monthly_story_limit = 210, daily_story_limit = 7,
  illustration_credits = 80, credits_reset_monthly = true,
  allow_byok = false, allow_illustrations = true;

UPDATE public.subscription_plans
   SET daily_story_limit = 50,
       monthly_story_limit = GREATEST(monthly_story_limit, 1500),
       illustration_credits = 200,
       credits_reset_monthly = true,
       allow_byok = true
 WHERE tier = 'pro_creator';

UPDATE public.subscription_plans
   SET daily_story_limit = 200,
       monthly_story_limit = GREATEST(monthly_story_limit, 6000),
       illustration_credits = 500,
       credits_reset_monthly = true,
       allow_byok = true
 WHERE tier = 'elite_publisher';

-- =========================================================================
-- 6. Seed credits for existing users
-- =========================================================================
INSERT INTO public.illustration_credits (user_id, balance, monthly_allocation, lifetime_only, last_reset_at)
SELECT p.user_id, 20, 0, true, now()
  FROM public.profiles p
  LEFT JOIN public.illustration_credits ic ON ic.user_id = p.user_id
 WHERE ic.user_id IS NULL;

-- =========================================================================
-- 7. handle_new_user — extend to seed credits
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'preferred_language', 'en')
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  -- Seed free-tier credits
  INSERT INTO public.illustration_credits (user_id, balance, monthly_allocation, lifetime_only, last_reset_at)
  VALUES (NEW.id, 20, 0, true, now())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- 8. RPC FUNCTIONS
-- =========================================================================

-- Registration check (used by client + edge functions)
CREATE OR REPLACE FUNCTION public.registration_allowed()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT allow_free_registrations FROM public.app_settings LIMIT 1), true);
$$;
GRANT EXECUTE ON FUNCTION public.registration_allowed() TO anon, authenticated;

-- Story fair-use quota check
CREATE OR REPLACE FUNCTION public.check_story_quota(_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier TEXT;
  v_daily_limit INT;
  v_monthly_limit INT;
  v_daily_used INT;
  v_monthly_used INT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_user');
  END IF;

  IF public.has_role(_user_id, 'admin') THEN
    RETURN jsonb_build_object('allowed', true, 'tier', 'admin', 'unlimited', true);
  END IF;

  SELECT COALESCE(s.plan_tier, 'free') INTO v_tier
    FROM public.user_subscriptions s
   WHERE s.user_id = _user_id AND s.status = 'active'
   ORDER BY s.created_at DESC LIMIT 1;
  v_tier := COALESCE(v_tier, 'free');

  SELECT daily_story_limit, monthly_story_limit
    INTO v_daily_limit, v_monthly_limit
    FROM public.subscription_plans WHERE tier = v_tier AND active = true;

  v_daily_limit := COALESCE(v_daily_limit, 3);
  v_monthly_limit := COALESCE(v_monthly_limit, 30);

  SELECT COUNT(*) INTO v_daily_used FROM public.ai_story_history
   WHERE user_id = _user_id AND created_at >= date_trunc('day', now());

  SELECT COUNT(*) INTO v_monthly_used FROM public.ai_story_history
   WHERE user_id = _user_id AND created_at >= date_trunc('month', now());

  RETURN jsonb_build_object(
    'allowed', (v_daily_used < v_daily_limit AND v_monthly_used < v_monthly_limit),
    'tier', v_tier,
    'daily_used', v_daily_used,
    'daily_limit', v_daily_limit,
    'monthly_used', v_monthly_used,
    'monthly_limit', v_monthly_limit,
    'reason', CASE
      WHEN v_daily_used >= v_daily_limit THEN 'daily_limit_reached'
      WHEN v_monthly_used >= v_monthly_limit THEN 'monthly_limit_reached'
      ELSE NULL END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_story_quota(UUID) TO authenticated, service_role;

-- Consume illustration credits atomically
CREATE OR REPLACE FUNCTION public.consume_illustration_credits(_user_id UUID, _amount INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_balance INT;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_input');
  END IF;

  -- Ensure a row exists
  INSERT INTO public.illustration_credits (user_id, balance, monthly_allocation, lifetime_only, last_reset_at)
  VALUES (_user_id, 20, 0, true, now())
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.illustration_credits
     SET balance = balance - _amount, updated_at = now()
   WHERE user_id = _user_id AND balance >= _amount
   RETURNING balance INTO v_balance;

  IF v_balance IS NULL THEN
    SELECT balance INTO v_balance FROM public.illustration_credits WHERE user_id = _user_id;
    RETURN jsonb_build_object('success', false, 'reason', 'insufficient_credits', 'balance', COALESCE(v_balance, 0));
  END IF;

  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION public.consume_illustration_credits(UUID, INT) TO service_role;

-- Refund (on generation failure)
CREATE OR REPLACE FUNCTION public.refund_illustration_credits(_user_id UUID, _amount INT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.illustration_credits
     SET balance = balance + _amount, updated_at = now()
   WHERE user_id = _user_id;
$$;
GRANT EXECUTE ON FUNCTION public.refund_illustration_credits(UUID, INT) TO service_role;

-- Monthly reset (cron-callable)
CREATE OR REPLACE FUNCTION public.reset_monthly_illustration_credits()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count INT;
BEGIN
  WITH active AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, p.illustration_credits, p.credits_reset_monthly
      FROM public.user_subscriptions s
      JOIN public.subscription_plans p ON p.tier = s.plan_tier
     WHERE s.status = 'active' AND p.credits_reset_monthly = true
     ORDER BY s.user_id, s.created_at DESC
  )
  UPDATE public.illustration_credits ic
     SET balance = a.illustration_credits,
         monthly_allocation = a.illustration_credits,
         lifetime_only = false,
         last_reset_at = now(),
         updated_at = now()
    FROM active a
   WHERE ic.user_id = a.user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_monthly_illustration_credits() TO service_role;
