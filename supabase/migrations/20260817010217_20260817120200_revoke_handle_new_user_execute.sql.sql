-- The REVOKE in the previous migration did not take effect because
-- Supabase's default grants re-apply EXECUTE to public. We need to
-- explicitly REVOKE from public and the specific roles again, and
-- also ensure no future auto-grant re-adds it.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

-- Verify the revocation took effect
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.handle_new_user()', 'execute') THEN
    RAISE NOTICE 'WARNING: anon still has EXECUTE on handle_new_user';
  END IF;
  IF has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') THEN
    RAISE NOTICE 'WARNING: authenticated still has EXECUTE on handle_new_user';
  END IF;
END
$$;