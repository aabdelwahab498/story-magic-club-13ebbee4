-- 1) Open trials for admin accounts: large lifetime illustration credit balance.
INSERT INTO public.illustration_credits (user_id, balance, monthly_allocation, lifetime_only, last_reset_at)
SELECT ur.user_id, 100000, 0, true, now()
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id) DO UPDATE
  SET balance = GREATEST(public.illustration_credits.balance, 100000),
      updated_at = now();

-- 2) New users get exactly ONE free illustrated story + PDF (10 credits = one batch),
--    after which they are directed to upgrade / pay.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- One free illustrated-story trial (10 credits = a single illustration batch).
  INSERT INTO public.illustration_credits (user_id, balance, monthly_allocation, lifetime_only, last_reset_at)
  VALUES (NEW.id, 10, 0, true, now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Ensure every user has an active free subscription (enables downloads)
  INSERT INTO public.user_subscriptions (user_id, plan_tier, status, starts_at)
  SELECT NEW.id, 'free', 'active', now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions WHERE user_id = NEW.id AND status = 'active'
  );

  RETURN NEW;
END;
$function$;