-- Lock down the new SECURITY DEFINER functions:
-- - enforce_invoice_limit: trigger function, not callable via RPC
-- - is_current_user_admin: only authenticated should call (uses auth.uid())
-- - get_user_tier: only authenticated should call (uses auth.uid())

REVOKE EXECUTE ON FUNCTION public.enforce_invoice_limit() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_tier() FROM public, anon;

-- Re-grant to authenticated only (in case the revoke from public removed it)
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tier() TO authenticated;