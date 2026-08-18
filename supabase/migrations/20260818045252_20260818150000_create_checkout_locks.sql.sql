/*
# Create checkout_locks table for concurrency-safe subscription checkout

## Purpose
Prevents two near-simultaneous checkout requests from the same user from
creating duplicate Stripe Checkout sessions. The edge function
`create-subscription-session` deletes expired locks then inserts a row with
a unique (user_id, plan) constraint before calling Stripe. If the insert
fails with a unique violation, another request is already in progress.

## New Tables
- `checkout_locks`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, not null)
  - `plan` (text, not null) — pro, business, or enterprise
  - `created_at` (timestamptz, default now())
  - `expires_at` (timestamptz, not null) — lock becomes stale after this

## Security
- RLS enabled; users can only access their own locks.
- Edge function uses service role key (bypasses RLS) for lock management.
- Unique index on (user_id, plan) ensures one active lock per user per plan.
- Index on expires_at supports stale-lock cleanup.

## Important Notes
1. This table is ONLY for concurrency control during checkout.
2. The edge function deletes expired locks (WHERE expires_at <= now())
   BEFORE inserting a new one, so stale locks never block new attempts.
3. Unique constraint violation on insert = another checkout is in progress.
*/

CREATE TABLE IF NOT EXISTS public.checkout_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes')
);

ALTER TABLE public.checkout_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_checkout_locks" ON public.checkout_locks;
CREATE POLICY "select_own_checkout_locks"
  ON public.checkout_locks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_checkout_locks" ON public.checkout_locks;
CREATE POLICY "insert_own_checkout_locks"
  ON public.checkout_locks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_checkout_locks" ON public.checkout_locks;
CREATE POLICY "update_own_checkout_locks"
  ON public.checkout_locks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_checkout_locks" ON public.checkout_locks;
CREATE POLICY "delete_own_checkout_locks"
  ON public.checkout_locks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_locks_user_plan
  ON public.checkout_locks (user_id, plan);

CREATE INDEX IF NOT EXISTS idx_checkout_locks_expires_at
  ON public.checkout_locks (expires_at);
