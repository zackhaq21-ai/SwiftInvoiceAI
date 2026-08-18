/*
# Enhance checkout_locks: per-user lock + persist pending checkout session

## Purpose
The original checkout_locks table had a unique constraint on (user_id, plan),
which allowed simultaneous Pro and Business checkout sessions for the same user.
This migration changes the uniqueness to per-user (one active checkout at a time
across ALL plans) and adds columns to persist the pending Stripe Checkout
session so repeated requests reuse the same session instead of creating new ones.

## Changes to existing table: checkout_locks
- Drop unique index idx_checkout_locks_user_plan (per-user-per-plan)
- Add unique index idx_checkout_locks_user (per-user, one active checkout)
- Add column: checkout_session_id (text, nullable) — Stripe Checkout Session ID
- Add column: checkout_url (text, nullable) — Stripe Checkout URL to redirect to
- Add column: idempotency_key (text, nullable) — attempt-specific Stripe idempotency key
- Add column: status (text, not null, default 'pending') — pending|completed|expired|failed

## Security
- RLS already enabled on checkout_locks; policies unchanged.
- New columns inherit existing RLS policies (owner-scoped).
- The unique index on user_id ensures only ONE checkout lock per user at a time,
  regardless of plan. Two concurrent requests for different plans cannot both
  proceed — the second gets a 23505 unique constraint violation.

## Important Notes
1. The edge function deletes expired/failed locks before inserting a new one.
2. On successful session creation, the lock row is UPDATED (not deleted) with
   the session ID, URL, and idempotency key. It stays until the webhook clears
   it (checkout.session.completed) or it expires (TTL 10 minutes).
3. A repeated request during the pending period finds the existing lock and
   returns the same checkout_url — never creates a second session.
4. On session creation FAILURE, the lock is deleted so the user can retry.
5. The idempotency_key is attempt-specific (includes a UUID suffix) so a fully
   canceled customer can repurchase later without Stripe returning an old
   completed session from a cached idempotency key.
6. The webhook clears the lock when checkout.session.completed fires for a
   subscription checkout, or when the session expires.
*/

DROP INDEX IF EXISTS public.idx_checkout_locks_user_plan;

ALTER TABLE public.checkout_locks
  ADD COLUMN IF NOT EXISTS checkout_session_id text,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- One active checkout lock per user, regardless of plan
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_locks_user
  ON public.checkout_locks (user_id);
