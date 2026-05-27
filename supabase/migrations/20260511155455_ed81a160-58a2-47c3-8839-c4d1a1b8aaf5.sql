-- Server-side gate for paid features (illustrations, PDF, audio).
-- Used by edge functions to enforce subscription limits regardless of client UI.
CREATE OR REPLACE FUNCTION public.has_paid_feature(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions s
    JOIN public.subscription_plans p ON p.tier = s.plan_tier AND p.active = true
    WHERE s.user_id = _user_id
      AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > now())
      AND CASE _feature
        WHEN 'illustrations' THEN p.allow_illustrations
        WHEN 'pdf'           THEN p.allow_pdf
        WHEN 'audio'         THEN p.allow_audio
        ELSE false
      END = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.has_paid_feature(uuid, text) TO service_role;