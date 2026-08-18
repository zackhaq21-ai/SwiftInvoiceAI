/**
 * Shared subscription-status logic for duplicate prevention.
 *
 * Used by tests and referenced by the create-subscription-session edge function.
 * The actual Stripe API calls happen in the edge function; these pure functions
 * encapsulate the decision logic so it can be unit-tested without network calls.
 */

/**
 * Subscription statuses from Stripe that indicate an active or recoverable
 * subscription. If any subscription across the user's Stripe customers has
 * one of these statuses, checkout must be blocked to prevent duplicates.
 *
 * - active: currently subscribed
 * - trialing: in trial period, will convert to paid
 * - past_due: payment failed but subscription still active (grace period)
 * - unpaid: invoices unpaid, subscription paused but not canceled
 * - incomplete: payment attempted, requires action
 * - incomplete_expired: incomplete subscription expired (treated as ended — NOT blocking)
 *
 * Note: "canceled" subscriptions are NOT blocking — the user may repurchase.
 * "incomplete_expired" is also NOT blocking — the attempt fully ended.
 */
const BLOCKING_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
]);

/**
 * Returns true if the subscription status blocks creating a new checkout.
 * A canceled or incomplete_expired subscription does NOT block.
 */
export function blocksCheckout(subscriptionStatus: string): boolean {
  return BLOCKING_STATUSES.has(subscriptionStatus);
}

/**
 * A subscription that is active but has cancel_at_period_end=true is still
 * active until the period ends — it must still block new checkouts.
 * This is handled by checking status === 'active' (which includes
 * cancel_at_period_end subscriptions in Stripe) but we expose this helper
 * for clarity in tests.
 */
export function isActiveWithCancellation(status: string, cancelAtPeriodEnd: boolean): boolean {
  return status === 'active' && cancelAtPeriodEnd === true;
}

interface SubscriptionCheck {
  status: string;
  cancel_at_period_end: boolean;
}

/**
 * Given a list of subscriptions (from one or more Stripe customers),
 * determine whether any of them blocks a new checkout.
 *
 * Returns true if checkout should be blocked (existing active/trialing/etc. subscription found).
 * Returns false if all subscriptions are canceled/ended and the user may repurchase.
 */
export function hasBlockingSubscription(subscriptions: SubscriptionCheck[]): boolean {
  return subscriptions.some(
    (sub) => blocksCheckout(sub.status) || isActiveWithCancellation(sub.status, sub.cancel_at_period_end),
  );
}

/**
 * Returns the list of statuses that block checkout. Exposed for tests and documentation.
 */
export function getBlockingStatuses(): string[] {
  return Array.from(BLOCKING_STATUSES);
}
