
CREATE OR REPLACE FUNCTION public.check_story_quota(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_tier TEXT;
  v_paddle_tier TEXT;
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

  -- Prefer Paddle (real-money) subscription if active
  v_paddle_tier := public.get_active_paddle_tier(_user_id);
  IF v_paddle_tier IS NOT NULL THEN
    v_tier := v_paddle_tier;
  ELSE
    SELECT COALESCE(s.plan_tier, 'free') INTO v_tier
      FROM public.user_subscriptions s
     WHERE s.user_id = _user_id AND s.status = 'active'
     ORDER BY s.created_at DESC LIMIT 1;
  END IF;
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
$function$;
