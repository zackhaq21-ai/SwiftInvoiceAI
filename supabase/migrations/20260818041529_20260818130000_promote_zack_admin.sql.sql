/*
# Promote zackhaq21@gmail.com to admin

## Summary
1. Insert the existing user zackhaq21@gmail.com into the admin_users table.
2. Update their subscription tier to 'admin'.
3. Idempotent — safe to re-run.
*/

INSERT INTO public.admin_users (user_id, email)
SELECT id, email FROM auth.users
WHERE email = 'zackhaq21@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.subscriptions
SET tier = 'admin', updated_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'zackhaq21@gmail.com');
