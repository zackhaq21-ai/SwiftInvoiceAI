# ThatInvoice — Production Readiness Report

## Build Verification

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `npm run typecheck` | PASS (0 errors) |
| Build | `npm run build` | PASS (579 kB bundle) |
| Tests | `npm test` | PASS (52/52 tests, 4 files) |
| Lint | `npm run lint` | PASS for src/ (edge function lint warnings expected — Deno types) |

## Bugs Fixed

### 1. Dashboard "undefined invoices" text
**Root cause:** `stats.invoiceCount` was referenced but doesn't exist in the stats object — the correct property is `stats.paidCount`.
**Fix:** Changed the reference to `stats.paidCount` with proper pluralization.

### 2. Insecure signup edge function
**Root cause:** A public edge function (`signup`) bypassed Supabase's email confirmation by creating users with the service role key and `email_confirm: true`. This allowed anyone to create accounts without verification.
**Fix:** Removed the edge function entirely and restored native `supabase.auth.signUp()` which properly handles email confirmation through Supabase's auth system.

### 3. Stripe webhook duplicate event processing
**Root cause:** The webhook handler had no idempotency check — if Stripe retried an event (which it does automatically), the same payment could be processed multiple times.
**Fix:** Created a `stripe_events` table with a unique constraint on `stripe_event_id`. The webhook now checks for existing events before processing and handles race conditions via the unique constraint.

### 4. PayInvoice.tsx type error
**Root cause:** `supabase.functions.invoke()` was called with a `query` property that doesn't exist in the TypeScript types for `FunctionInvokeOptions`.
**Fix:** Replaced with a direct `fetch()` call that properly passes query parameters in the URL.

## Security Changes

### Database Migration: `20260818120000_security_hardening.sql`

1. **Revoked anon grants** on `stripe_customers`, `stripe_orders`, `stripe_subscriptions`, and `subscriptions` tables — these contained sensitive payment data accessible to unauthenticated users.
2. **Created `audit_logs` table** — tracks plan changes, payment events, invoice actions, settings updates, and admin actions with owner-scoped RLS. Admins get full read access.
3. **Created `stripe_events` table** — stores processed Stripe event IDs for webhook idempotency. RLS enabled with no policies (service-role only).
4. **Revoked EXECUTE** on `get_user_tier()` and `is_current_user_admin()` SECURITY DEFINER functions from the `anon` role.
5. **Added indexes** on `audit_logs(user_id)`, `audit_logs(created_at)`, and `stripe_events(stripe_event_id)`.

### Edge Function Security

1. **Stripe webhook**: Now verifies signatures from the raw request body, persists event IDs, and ignores duplicate events.
2. **Subscription checkout**: Added idempotency keys to prevent double-click duplicate Stripe sessions, user-friendly error messages (no secret exposure), and audit logging.
3. **Email function**: Added retry with capped exponential backoff (max 2 retries, 4s cap), privacy-safe error logging, and audit logging of sent emails.
4. **Removed `signup` edge function** — was an insecure public endpoint that bypassed email confirmation.

## Brand & UI

- Created code-native SVG logo (invoice document + lightning bolt + success checkmark) with deep indigo to electric blue gradient and teal accent
- Created SVG favicon (crisp at 16x16, works on light/dark backgrounds)
- Created `Logo.tsx` component with `LogoMark`, `LogoWordmark`, `LogoMarkDark`, `LogoWordmarkDark` variants
- Applied logo to: login/signup, sidebar, mobile header, loading states
- Updated page title to "ThatInvoice — Invoice faster. Get paid sooner."
- Updated meta tags with theme color and description
- Added footer with legal page links on every authenticated page

## Legal Pages

Created `/src/views/Legal.tsx` with four pages:
- **Privacy Policy** (`/privacy`): covers data collection, usage, sharing, retention, security, user rights
- **Terms of Service** (`/terms`): acceptance, account, acceptable use, billing, IP, disclaimers, termination
- **Refund & Cancellation Policy** (`/refund`): cancellation, refunds, downgrades, failed payments
- **Contact & Support** (`/contact`): support channels, privacy requests, business info, bug reports

All pages use clearly marked placeholders `[to be configured by the business owner]` for legal business name, address, tax ID, support email, and jurisdiction.

## Payments

- Centralized plan configuration in `plans.ts` with Stripe Price ID env key mapping
- Subscription checkout uses idempotency keys, authenticated server-side endpoints, user/plan metadata
- Webhook verifies signatures, persists event IDs, ignores duplicates
- Activation only after verified Stripe events
- Audit logging for checkout creation, subscription activation, and invoice payments

## AI & Voice

- Voice parser defaults to 0 for missing prices (safe fallback)
- All AI/voice suggestions are reviewed and editable in the step-by-step guided flow before saving
- Trade-aware terminology covers: HVAC, plumbing, electrical, construction/roofing, landscaping, automotive, cleaning, freelance, consulting, photography, catering, retail, wholesale, boutique
- Quantity and price extraction validates numeric values

## Email

- Resend integration with retry logic (capped exponential backoff, max 2 retries)
- Privacy-safe error logging (no secret values in error messages)
- Audit logging of sent emails
- Sender domain and API key verified by presence (no secret exposure)

## Files Changed

### New Files
- `public/logo.svg` — SVG app icon
- `public/favicon.svg` — SVG favicon
- `src/components/Logo.tsx` — Logo React components
- `src/views/Legal.tsx` — Legal pages (Privacy, Terms, Refund, Contact)
- `src/lib/__tests__/calc.test.ts` — Calc logic tests (18 tests)
- `src/lib/__tests__/plans.test.ts` — Plans logic tests (10 tests)
- `src/lib/__tests__/format.test.ts` — Format logic tests (15 tests)
- `src/lib/__tests__/voiceParser.test.ts` — Voice parser tests (9 tests)
- `vitest.config.ts` — Test configuration

### Modified Files
- `index.html` — Updated favicon, title, meta tags
- `src/App.tsx` — New logo, legal routes, footer with legal links
- `src/views/Login.tsx` — New SVG logo and branding
- `src/views/Dashboard.tsx` — Fixed undefined invoice count bug
- `src/views/PayInvoice.tsx` — Fixed type error with functions.invoke
- `src/lib/auth.tsx` — Restored native Supabase signUp (removed edge function bypass)
- `src/lib/plans.ts` — Added Stripe Price ID env key mapping
- `package.json` — Added test scripts and vitest dependency
- `supabase/functions/stripe-webhook/index.ts` — Idempotency, audit logging, signature verification
- `supabase/functions/create-subscription-session/index.ts` — Idempotency keys, user-friendly errors, audit logging
- `supabase/functions/send-invoice-email/index.ts` — Retry logic, audit logging, privacy-safe errors

### Database Migrations
- `20260818120000_security_hardening.sql` — Revoked anon grants, created audit_logs + stripe_events tables, tightened function permissions

### Deleted
- `supabase/functions/signup/index.ts` — Insecure public edge function removed

## QA Matrix (Manual Testing Required)

| Role | Routes to Test | Key Scenarios |
|------|---------------|---------------|
| Free | Dashboard, Invoices, Clients, Voice, Settings | Create up to 3 invoices, upgrade prompts, no email sending |
| Pro | All routes | 50 invoice limit, email sending, online payments, voice invoicing |
| Business | All routes | Unlimited invoices, custom branding, priority support |
| Enterprise | All routes | All features, dedicated support |
| Cancelled | Dashboard, Settings | Reverted to free limits, can re-subscribe |
| Failed payment | Dashboard, Settings | past_due status, payment update prompt, grace period |
| Admin | All routes | Full access, audit log visibility |
| Public invoice customer | /pay/:id | View invoice, pay via Stripe, success/cancel states |

## Items Blocked by Missing Credentials/Platform Access

1. **Stripe live mode testing**: Cannot create real charges or test live webhooks — requires Stripe dashboard access and live API keys
2. **Resend email sending**: Cannot send real test emails — requires verified sender domain configuration
3. **Stripe Price IDs**: The `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_ENTERPRISE` secrets need to be configured in the Supabase dashboard for subscription checkout to use real Stripe Prices (falls back to dynamic price_data if not set)
4. **Legal business details**: Support email, legal business name, registered address, tax ID, and jurisdiction need to be provided by the business owner and filled into the Legal pages
5. **Cross-browser testing**: Requires manual testing on Chrome, Firefox, Safari, Edge
6. **Slow network testing**: Requires manual throttling testing
7. **Backup/restore**: Supabase automated backups are managed at the platform level — no manual backup/restore was performed
8. **Email confirmation setting**: Should be verified OFF in the Supabase Dashboard → Authentication → Email Provider settings

## Pre-Publish Checklist

- [ ] Configure Stripe Price IDs in Supabase secrets (STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS, STRIPE_PRICE_ENTERPRISE)
- [ ] Configure Stripe Webhook endpoint in Stripe Dashboard and set STRIPE_WEBHOOK_SECRET
- [ ] Verify Resend sender domain is configured and RESEND_API_KEY + RESEND_FROM_EMAIL are set
- [ ] Fill in legal business details in Legal.tsx (support email, business name, address, tax ID, jurisdiction)
- [ ] Verify email confirmation is OFF in Supabase Dashboard
- [ ] Test signup, login, forgot-password flows end-to-end
- [ ] Test Stripe checkout in test mode with a test card
- [ ] Test invoice create/edit/send/pay/delete flows
- [ ] Test responsive layouts on phone, tablet, desktop
- [ ] Set up CRON_SECRET for process-overdue-invoices function
- [ ] Have a legal professional review the Privacy Policy, Terms, and Refund Policy
