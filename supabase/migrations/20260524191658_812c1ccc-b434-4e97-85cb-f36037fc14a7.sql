
-- 1) Trigger: auto-create profile + role on new auth user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Approve manual payment atomically (admin-only)
CREATE OR REPLACE FUNCTION public.approve_manual_payment(_request_id uuid, _months integer DEFAULT 1)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.manual_payment_requests%ROWTYPE;
  v_sub_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve payments';
  END IF;

  SELECT * INTO v_req FROM public.manual_payment_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment request not found'; END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment request already %', v_req.status;
  END IF;

  v_expires_at := now() + (_months || ' months')::interval;

  -- Mark previous active subs as superseded
  UPDATE public.user_subscriptions
     SET status = 'superseded', updated_at = now()
   WHERE user_id = v_req.user_id AND status = 'active';

  -- Create new active sub
  INSERT INTO public.user_subscriptions (user_id, plan_tier, status, starts_at, expires_at, payment_method, payment_request_id)
  VALUES (v_req.user_id, v_req.plan_tier, 'active', now(), v_expires_at, v_req.method, v_req.id)
  RETURNING id INTO v_sub_id;

  -- Mark request approved (bypass immutability via admin role)
  UPDATE public.manual_payment_requests
     SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   WHERE id = _request_id;

  RETURN v_sub_id;
END;
$$;

-- 3) Reject manual payment
CREATE OR REPLACE FUNCTION public.reject_manual_payment(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reject payments';
  END IF;
  UPDATE public.manual_payment_requests
     SET status = 'rejected', admin_note = _reason, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   WHERE id = _request_id AND status = 'pending';
END;
$$;

-- 4) Expire due subscriptions
CREATE OR REPLACE FUNCTION public.expire_due_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.user_subscriptions
     SET status = 'expired', updated_at = now()
   WHERE status = 'active'
     AND expires_at IS NOT NULL
     AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5) updated_at triggers on key tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','child_profiles','stories','blog_posts','products','videos',
    'user_subscriptions','manual_payment_requests','ai_story_history','reading_streaks','bedtime_schedules'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;
