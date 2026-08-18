/*
# Add invoice payment tracking

## What this does
Adds columns to track direct Stripe payments and Hearth financing links on invoices,
plus payment-configuration fields on the business profile so each business can
enable payments and store their Hearth merchant URL.

## Changes

### invoices table (new columns)
- `stripe_payment_intent_id` (text, nullable) — Stripe Payment Intent ID once a charge succeeds.
- `stripe_checkout_session_id` (text, nullable) — Stripe Checkout Session ID created when a customer starts payment.
- `payment_status` (text, not null, default 'unpaid') — one of: unpaid, pending, paid, financing_pending.
  'pending' = checkout session created but not yet paid.
  'financing_pending' = customer clicked through to Hearth financing application.
- `hearth_status` (text, nullable) — manual financing status: applied / approved / funded (set by business owner).
- `hearth_application_url` (text, nullable) — per-invoice Hearth application link if the business overrides their default.

### business_profile table (new columns)
- `payments_enabled` (boolean, not null, default false) — master toggle for accepting direct card payments.
- `hearth_merchant_url` (text, nullable) — the business's Hearth financing application base URL.
- `hearth_enabled` (boolean, not null, default false) — whether to show financing links on invoices.

## Security
- No new tables. All new columns inherit existing RLS policies on invoices and business_profile.
- Payment-intent and checkout-session IDs are set server-side by edge functions (Stripe webhook / checkout creation),
  not by the client. The business owner can toggle `payments_enabled` / `hearth_enabled` and set `hearth_merchant_url`
  through the existing UPDATE policy on business_profile.
- `payment_status` is updated by the business owner through the existing invoice UPDATE policy (or by the webhook edge
  function using the service role key, which bypasses RLS by design).

## Important notes
1. No data is lost — all additions are additive ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
2. No products or prices are created in Stripe. The checkout session uses dynamic line items with the invoice total.
3. `payment_status` is separate from the existing `status` column (draft/sent/paid/overdue) so payment tracking and
   workflow status can evolve independently. When payment_status becomes 'paid', the edge function also sets
   status = 'paid'.
*/

-- invoices: payment tracking columns
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS hearth_status text,
  ADD COLUMN IF NOT EXISTS hearth_application_url text;

-- business_profile: payment configuration
ALTER TABLE business_profile
  ADD COLUMN IF NOT EXISTS payments_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hearth_merchant_url text,
  ADD COLUMN IF NOT EXISTS hearth_enabled boolean NOT NULL DEFAULT false;

-- Index for webhook lookups by checkout session id
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id ON invoices(stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent_id ON invoices(stripe_payment_intent_id);
