
-- 1) Validation trigger: ensure amount matches the plan price for the chosen currency
CREATE OR REPLACE FUNCTION public.validate_manual_payment_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_expected NUMERIC;
  v_settings public.payment_settings%ROWTYPE;
  v_method_enabled BOOLEAN := false;
  v_method_currencies TEXT[];
  v_pending_count INT;
BEGIN
  -- Only validate on initial insert / when still pending
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'pending') THEN

    -- Free tier cannot be purchased manually
    IF NEW.plan_tier = 'free' THEN
      RAISE EXCEPTION 'Free tier does not require payment';
    END IF;

    -- Currency must be EGP or USD
    IF NEW.currency NOT IN ('EGP', 'USD') THEN
      RAISE EXCEPTION 'Invalid currency: %', NEW.currency;
    END IF;

    -- Method must be one of the supported values
    IF NEW.method NOT IN ('instapay','vodafone_cash','payoneer','bank_transfer') THEN
      RAISE EXCEPTION 'Invalid payment method: %', NEW.method;
    END IF;

    -- Look up the plan
    SELECT * INTO v_plan
      FROM public.subscription_plans
      WHERE tier = NEW.plan_tier AND active = true
      LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Plan not found or inactive: %', NEW.plan_tier;
    END IF;

    -- Expected amount based on currency
    v_expected := CASE NEW.currency
      WHEN 'EGP' THEN v_plan.price_egp
      WHEN 'USD' THEN v_plan.price_usd
    END;
    IF v_expected IS NULL OR v_expected <= 0 THEN
      RAISE EXCEPTION 'Plan does not have a price in %', NEW.currency;
    END IF;
    IF NEW.amount <> v_expected THEN
      RAISE EXCEPTION 'Amount % does not match plan price % %', NEW.amount, v_expected, NEW.currency;
    END IF;

    -- Validate that the chosen method is enabled and supports the currency
    SELECT * INTO v_settings FROM public.payment_settings LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment settings not configured';
    END IF;

    IF NEW.method = 'instapay' THEN
      v_method_enabled := v_settings.instapay_enabled;
      v_method_currencies := v_settings.instapay_currencies;
    ELSIF NEW.method = 'vodafone_cash' THEN
      v_method_enabled := v_settings.vodafone_enabled;
      v_method_currencies := v_settings.vodafone_currencies;
    ELSIF NEW.method = 'payoneer' THEN
      v_method_enabled := v_settings.payoneer_enabled;
      v_method_currencies := v_settings.payoneer_currencies;
    ELSIF NEW.method = 'bank_transfer' THEN
      v_method_enabled := v_settings.bank_enabled;
      v_method_currencies := v_settings.bank_currencies;
    END IF;

    IF NOT v_method_enabled THEN
      RAISE EXCEPTION 'Payment method % is not enabled', NEW.method;
    END IF;
    IF NOT (NEW.currency = ANY(v_method_currencies)) THEN
      RAISE EXCEPTION 'Method % does not accept currency %', NEW.method, NEW.currency;
    END IF;

    -- Length limits on text fields
    IF NEW.sender_name IS NOT NULL AND char_length(NEW.sender_name) > 100 THEN
      RAISE EXCEPTION 'sender_name too long';
    END IF;
    IF NEW.sender_phone IS NOT NULL AND char_length(NEW.sender_phone) > 30 THEN
      RAISE EXCEPTION 'sender_phone too long';
    END IF;
    IF NEW.transaction_ref IS NOT NULL AND char_length(NEW.transaction_ref) > 80 THEN
      RAISE EXCEPTION 'transaction_ref too long';
    END IF;

    -- Rate limit: max 3 pending requests per user
    IF TG_OP = 'INSERT' THEN
      SELECT COUNT(*) INTO v_pending_count
        FROM public.manual_payment_requests
        WHERE user_id = NEW.user_id AND status = 'pending';
      IF v_pending_count >= 3 THEN
        RAISE EXCEPTION 'Too many pending payment requests. Please wait for review.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_manual_payment_request ON public.manual_payment_requests;
CREATE TRIGGER trg_validate_manual_payment_request
  BEFORE INSERT OR UPDATE ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_manual_payment_request();

-- 2) Storage RLS for payment-proofs bucket
-- Users may only read/write inside their own folder ({user_id}/...)
DROP POLICY IF EXISTS "Users upload own payment proofs" ON storage.objects;
CREATE POLICY "Users upload own payment proofs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users view own payment proofs" ON storage.objects;
CREATE POLICY "Users view own payment proofs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins manage payment proofs" ON storage.objects;
CREATE POLICY "Admins manage payment proofs"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

-- 3) updated_at trigger on manual_payment_requests if missing
DROP TRIGGER IF EXISTS trg_mpr_updated_at ON public.manual_payment_requests;
CREATE TRIGGER trg_mpr_updated_at
  BEFORE UPDATE ON public.manual_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
