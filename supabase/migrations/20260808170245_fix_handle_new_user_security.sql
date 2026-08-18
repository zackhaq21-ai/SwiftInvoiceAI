-- Revoke EXECUTE on handle_new_user from anon and authenticated roles.
-- This function is a trigger function called by the database on user signup,
-- not by clients via the REST API. Public EXECUTE grants are unnecessary
-- and were flagged by the Supabase security advisor.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;