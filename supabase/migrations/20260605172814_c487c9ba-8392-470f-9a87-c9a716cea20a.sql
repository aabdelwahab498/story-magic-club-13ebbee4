-- 1. CHECK: illustration credits cannot go negative
ALTER TABLE public.illustration_credits
  DROP CONSTRAINT IF EXISTS illustration_credits_balance_nonneg;
ALTER TABLE public.illustration_credits
  ADD CONSTRAINT illustration_credits_balance_nonneg CHECK (balance >= 0);

-- 2. consume_credits: atomic deduction
CREATE OR REPLACE FUNCTION public.consume_credits(_user_id uuid, _n integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _n IS NULL OR _n < 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  UPDATE public.illustration_credits
    SET balance = balance - _n,
        updated_at = now()
    WHERE user_id = _user_id
      AND balance >= _n
    RETURNING balance INTO new_balance;
  RETURN new_balance; -- null when insufficient or row missing
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_credits(uuid, integer) TO service_role;

-- 3. grant_credits: atomic addition (upsert)
CREATE OR REPLACE FUNCTION public.grant_credits(_user_id uuid, _n integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _n IS NULL OR _n < 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  INSERT INTO public.illustration_credits (user_id, balance, updated_at)
    VALUES (_user_id, _n, now())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.illustration_credits.balance + EXCLUDED.balance,
          updated_at = now()
    RETURNING balance INTO new_balance;
  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer) TO service_role;

-- Ensure user_id is unique on illustration_credits so upsert works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'illustration_credits_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.illustration_credits
        ADD CONSTRAINT illustration_credits_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table THEN
      NULL;
    END;
  END IF;
END $$;

-- 4. reset_monthly_credits: refill paid users
CREATE OR REPLACE FUNCTION public.reset_monthly_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.illustration_credits AS ic
    SET balance = ic.monthly_allocation,
        last_reset_at = now(),
        updated_at = now()
    WHERE ic.monthly_allocation > 0
      AND ic.lifetime_only = false
      AND (ic.last_reset_at IS NULL OR ic.last_reset_at < now() - interval '30 days');
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_monthly_credits() FROM public;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credits() TO service_role;

-- 5. Unique active Paddle subscription per user
DROP INDEX IF EXISTS paddle_subscriptions_active_unique;
CREATE UNIQUE INDEX paddle_subscriptions_active_unique
  ON public.paddle_subscriptions(user_id)
  WHERE status IN ('active', 'trialing');

-- Also unique constraint on paddle_subscription_id for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paddle_subscriptions_paddle_sub_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.paddle_subscriptions
        ADD CONSTRAINT paddle_subscriptions_paddle_sub_id_key UNIQUE (paddle_subscription_id);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- paddle_webhook_events.event_id unique (used in onConflict)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paddle_webhook_events_event_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.paddle_webhook_events
        ADD CONSTRAINT paddle_webhook_events_event_id_key UNIQUE (event_id);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

-- 6. Hot-path indexes
CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
  ON public.contact_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_story_history_user_created
  ON public.ai_story_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paddle_transactions_user_created
  ON public.paddle_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paddle_transactions_tx_id
  ON public.paddle_transactions(paddle_transaction_id)
  WHERE paddle_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_identifier_created
  ON public.rate_limit_events(identifier, endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created
  ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drawing_votes_user_drawing
  ON public.drawing_votes(user_id, drawing_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_log_created
  ON public.email_delivery_log(created_at DESC);

-- 7. Fix editor update policy on stories — previously blocked re-edits of published stories
DROP POLICY IF EXISTS "Editors update stories" ON public.stories;
CREATE POLICY "Editors update stories"
  ON public.stories
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'editor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- 8. Rate-limit cleanup helper
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.rate_limit_events WHERE created_at < now() - interval '2 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;
  DELETE FROM public.rate_limit_blocks WHERE blocked_until < now() - interval '7 days';
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_rate_limit_events() FROM public;
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_events() TO service_role;

-- 9. is_featured flag on subscription_plans (for "Most popular" badge)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;