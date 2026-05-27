CREATE OR REPLACE FUNCTION public.lock_manual_payment_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.plan_tier IS DISTINCT FROM OLD.plan_tier
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.method IS DISTINCT FROM OLD.method
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Cannot modify plan, amount, currency, method, user, or status of an existing payment request';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_manual_payment_immutable ON public.manual_payment_requests;
CREATE TRIGGER lock_manual_payment_immutable
  BEFORE UPDATE ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.lock_manual_payment_immutable_fields();

REVOKE EXECUTE ON FUNCTION public.lock_manual_payment_immutable_fields() FROM PUBLIC, anon, authenticated;