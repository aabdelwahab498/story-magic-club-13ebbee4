
REVOKE EXECUTE ON FUNCTION public.approve_manual_payment(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_manual_payment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_due_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_manual_payment(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_manual_payment(uuid, text) TO authenticated;
