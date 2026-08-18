-- Seed admin users from the hardcoded admin emails into the new
-- admin_users table. This migrates the client-side admin list
-- to server-side enforcement. Uses a subquery to resolve user IDs
-- from auth.users by email.

INSERT INTO public.admin_users (user_id, email)
SELECT id, email FROM auth.users
WHERE email IN ('zackhaq21@gmail.com', 'don@krushexclusive.com')
ON CONFLICT (user_id) DO NOTHING;