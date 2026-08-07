-- 1. manual_payment_requests: restrict self-updates to safe fields
DROP POLICY IF EXISTS "Users update own pending" ON public.manual_payment_requests;
CREATE POLICY "Users update own pending"
ON public.manual_payment_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 2. orders: lock financial/fulfillment fields on owner updates
CREATE OR REPLACE FUNCTION public.guard_orders_owner_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.payment_request_id IS DISTINCT FROM OLD.payment_request_id
     OR NEW.paddle_transaction_id IS DISTINCT FROM OLD.paddle_transaction_id
     OR NEW.paddle_checkout_id IS DISTINCT FROM OLD.paddle_checkout_id
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status
     OR NEW.fulfilled_at IS DISTINCT FROM OLD.fulfilled_at
     OR NEW.fulfilled_by IS DISTINCT FROM OLD.fulfilled_by
     OR NEW.admin_note IS DISTINCT FROM OLD.admin_note
     OR NEW.shipping_status IS DISTINCT FROM OLD.shipping_status
     OR NEW.tracking_number IS DISTINCT FROM OLD.tracking_number
     OR NEW.tracking_carrier IS DISTINCT FROM OLD.tracking_carrier
     OR NEW.shipped_at IS DISTINCT FROM OLD.shipped_at
     OR NEW.delivered_at IS DISTINCT FROM OLD.delivered_at THEN
    RAISE EXCEPTION 'Only shipping details and notes can be modified on a pending order';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_orders_owner_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_orders_owner_update ON public.orders;
CREATE TRIGGER trg_guard_orders_owner_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_orders_owner_update();

DROP POLICY IF EXISTS "Users update own pending orders" ON public.orders;
CREATE POLICY "Users update own pending orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status = 'pending')
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 3. user_subscriptions: only a single free/active self-insert, no paid self-grant
CREATE OR REPLACE FUNCTION public.guard_user_subscription_self_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_tier <> 'free'
     OR NEW.status <> 'active'
     OR NEW.expires_at IS NOT NULL
     OR NEW.payment_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only a free active subscription can be self-assigned';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_subscriptions
     WHERE user_id = NEW.user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'An active subscription already exists';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_user_subscription_self_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_user_subscription_self_insert ON public.user_subscriptions;
CREATE TRIGGER trg_guard_user_subscription_self_insert
BEFORE INSERT ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.guard_user_subscription_self_insert();

DROP POLICY IF EXISTS "Users insert own free sub" ON public.user_subscriptions;
CREATE POLICY "Users insert own free sub"
ON public.user_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND plan_tier = 'free'
  AND status = 'active'
  AND expires_at IS NULL
  AND payment_request_id IS NULL
);