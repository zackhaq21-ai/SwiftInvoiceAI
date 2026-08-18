/*
# Security Hardening — Revoke Anon Grants, Audit Log, Webhook Idempotency

## Summary
1. Revoke ALL privileges from the `anon` role on Stripe-related tables and subscriptions table.
2. Create an `audit_logs` table to track plan, payment, invoice, settings, and admin changes with owner-scoped RLS.
3. Create a `stripe_events` table to track processed Stripe event IDs for webhook idempotency.
4. Revoke EXECUTE on the two SECURITY DEFINER functions from anon.
5. Add performance indexes.

## New Tables
- audit_logs: tracks user actions (plan changes, payment events, settings updates, admin actions)
- stripe_events: tracks processed Stripe event IDs for webhook idempotency
*/

-- 1. Revoke anon privileges on sensitive tables
REVOKE ALL ON public.stripe_customers FROM anon;
REVOKE ALL ON public.stripe_orders FROM anon;
REVOKE ALL ON public.stripe_subscriptions FROM anon;
REVOKE ALL ON public.subscriptions FROM anon;

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL DEFAULT 'general',
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_logs" ON public.audit_logs;
CREATE POLICY "select_own_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_audit_logs" ON public.audit_logs;
CREATE POLICY "insert_own_audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_all_audit_logs_admin" ON public.audit_logs;
CREATE POLICY "select_all_audit_logs_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.user_id = auth.uid())
  );

-- 3. Create stripe_events table for webhook idempotency
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION public.get_user_tier() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon;

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);
