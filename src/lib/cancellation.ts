import type { SubscriptionTier } from '@/lib/types';

export interface CancellationEligibility {
  canCancel: boolean;
  canResume: boolean;
  reason?: string;
}

export function getCancellationEligibility(
  tier: SubscriptionTier,
  cancelAtPeriodEnd: boolean,
  subscriptionStatus: string | null,
): CancellationEligibility {
  // Admin and free users cannot cancel
  if (tier === 'admin') {
    return { canCancel: false, canResume: false, reason: 'Admin accounts do not have a paid subscription.' };
  }
  if (tier === 'free') {
    return { canCancel: false, canResume: false, reason: 'You are on the Free plan — no subscription to cancel.' };
  }

  // If cancellation is already scheduled, show resume option
  if (cancelAtPeriodEnd) {
    return { canCancel: false, canResume: true };
  }

  // Only active paid subscriptions can be cancelled
  if (subscriptionStatus && !['active', 'trialing'].includes(subscriptionStatus)) {
    return {
      canCancel: false,
      canResume: false,
      reason: `Subscription status is "${subscriptionStatus}". Only active subscriptions can be cancelled.`,
    };
  }

  return { canCancel: true, canResume: false };
}

export function formatPeriodEnd(periodEnd: string | null): string | null {
  if (!periodEnd) return null;
  const date = new Date(periodEnd);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function isCancellationPending(sub: { cancel_at_period_end?: boolean } | null): boolean {
  return sub?.cancel_at_period_end === true;
}
