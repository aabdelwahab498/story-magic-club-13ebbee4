CREATE OR REPLACE FUNCTION public.consume_illustration_batch_credits(
  _user_id uuid,
  _story_id text,
  _amount integer
)
RETURNS TABLE(success boolean, balance integer, charged boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF _amount <= 0 OR _story_id IS NULL OR length(_story_id) = 0 THEN
    RAISE EXCEPTION 'invalid_illustration_batch_charge';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _story_id, 0));

  SELECT ic.balance INTO v_balance
  FROM public.illustration_credits ic
  WHERE ic.user_id = _user_id;

  IF EXISTS (
    SELECT 1 FROM public.illustration_job_events e
    WHERE e.user_id = _user_id
      AND e.story_id = _story_id
      AND e.event = 'credit'
      AND e.status = 'charged'
  ) THEN
    RETURN QUERY SELECT true, COALESCE(v_balance, 0), false;
    RETURN;
  END IF;

  UPDATE public.illustration_credits ic
  SET balance = ic.balance - _amount, updated_at = now()
  WHERE ic.user_id = _user_id AND ic.balance >= _amount
  RETURNING ic.balance INTO v_balance;

  IF NOT FOUND THEN
    SELECT ic.balance INTO v_balance FROM public.illustration_credits ic WHERE ic.user_id = _user_id;
    RETURN QUERY SELECT false, COALESCE(v_balance, 0), false;
    RETURN;
  END IF;

  INSERT INTO public.illustration_job_events(user_id, story_id, event, status, source, details)
  VALUES (_user_id, _story_id, 'credit', 'charged', 'atomic_batch_reservation',
          jsonb_build_object('amount', _amount, 'balance', v_balance));
  RETURN QUERY SELECT true, v_balance, true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_illustration_batch_credits(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_illustration_batch_credits(uuid, text, integer) TO service_role;