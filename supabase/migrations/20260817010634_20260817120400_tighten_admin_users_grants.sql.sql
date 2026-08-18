-- Tighten admin_users table: remove INSERT/UPDATE/DELETE grants
-- from anon and authenticated. Only SELECT should be available
-- (and only via the select_own_admin policy for the user's own row).
-- This ensures even if a policy were accidentally added, the grants
-- wouldn't allow writes from the API.

REVOKE INSERT, UPDATE, DELETE ON admin_users FROM anon, authenticated;
REVOKE ALL ON admin_users FROM anon;

-- Keep SELECT for authenticated (needed for the RLS policy to work)
GRANT SELECT ON admin_users TO authenticated;