import { describe, it, expect } from 'vitest';
import {
  blocksCheckout,
  hasBlockingSubscription,
  isActiveWithCancellation,
  getBlockingStatuses,
} from '@/lib/subscriptionCheck';

describe('blocksCheckout', () => {
  it('blocks active subscriptions', () => {
    expect(blocksCheckout('active')).toBe(true);
  });

  it('blocks trialing subscriptions', () => {
    expect(blocksCheckout('trialing')).toBe(true);
  });

  it('blocks past_due subscriptions', () => {
    expect(blocksCheckout('past_due')).toBe(true);
  });

  it('blocks unpaid subscriptions', () => {
    expect(blocksCheckout('unpaid')).toBe(true);
  });

  it('blocks incomplete subscriptions', () => {
    expect(blocksCheckout('incomplete')).toBe(true);
  });

  it('does NOT block canceled subscriptions (allows repurchase)', () => {
    expect(blocksCheckout('canceled')).toBe(false);
  });

  it('does NOT block incomplete_expired subscriptions (fully ended)', () => {
    expect(blocksCheckout('incomplete_expired')).toBe(false);
  });

  it('does NOT block unknown statuses', () => {
    expect(blocksCheckout('unknown')).toBe(false);
    expect(blocksCheckout('')).toBe(false);
  });
});

describe('isActiveWithCancellation', () => {
  it('returns true for active with cancel_at_period_end', () => {
    expect(isActiveWithCancellation('active', true)).toBe(true);
  });

  it('returns false for active without cancel_at_period_end', () => {
    expect(isActiveWithCancellation('active', false)).toBe(false);
  });

  it('returns false for canceled with cancel_at_period_end=true (already canceled)', () => {
    expect(isActiveWithCancellation('canceled', true)).toBe(false);
  });

  it('returns false for past_due with cancel_at_period_end', () => {
    expect(isActiveWithCancellation('past_due', true)).toBe(false);
  });
});

describe('hasBlockingSubscription', () => {
  it('returns true when one active subscription exists among many', () => {
    expect(hasBlockingSubscription([
      { status: 'canceled', cancel_at_period_end: false },
      { status: 'active', cancel_at_period_end: false },
      { status: 'canceled', cancel_at_period_end: false },
    ])).toBe(true);
  });

  it('returns true for active with cancel_at_period_end (still active until period end)', () => {
    expect(hasBlockingSubscription([
      { status: 'active', cancel_at_period_end: true },
    ])).toBe(true);
  });

  it('returns true for trialing subscription', () => {
    expect(hasBlockingSubscription([
      { status: 'trialing', cancel_at_period_end: false },
    ])).toBe(true);
  });

  it('returns true for past_due subscription', () => {
    expect(hasBlockingSubscription([
      { status: 'past_due', cancel_at_period_end: false },
    ])).toBe(true);
  });

  it('returns true for unpaid subscription', () => {
    expect(hasBlockingSubscription([
      { status: 'unpaid', cancel_at_period_end: false },
    ])).toBe(true);
  });

  it('returns true for incomplete subscription', () => {
    expect(hasBlockingSubscription([
      { status: 'incomplete', cancel_at_period_end: false },
    ])).toBe(true);
  });

  it('returns false when all subscriptions are canceled (allows repurchase)', () => {
    expect(hasBlockingSubscription([
      { status: 'canceled', cancel_at_period_end: false },
      { status: 'canceled', cancel_at_period_end: false },
    ])).toBe(false);
  });

  it('returns false for incomplete_expired (fully ended, allows repurchase)', () => {
    expect(hasBlockingSubscription([
      { status: 'incomplete_expired', cancel_at_period_end: false },
    ])).toBe(false);
  });

  it('returns false for empty subscription list', () => {
    expect(hasBlockingSubscription([])).toBe(false);
  });

  it('returns true when multiple customers have active subs (duplicate detection)', () => {
    expect(hasBlockingSubscription([
      { status: 'active', cancel_at_period_end: false },
      { status: 'active', cancel_at_period_end: false },
    ])).toBe(true);
  });
});

describe('getBlockingStatuses', () => {
  it('returns all 5 blocking statuses', () => {
    const statuses = getBlockingStatuses();
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain('active');
    expect(statuses).toContain('trialing');
    expect(statuses).toContain('past_due');
    expect(statuses).toContain('unpaid');
    expect(statuses).toContain('incomplete');
  });

  it('does not include canceled or incomplete_expired', () => {
    const statuses = getBlockingStatuses();
    expect(statuses).not.toContain('canceled');
    expect(statuses).not.toContain('incomplete_expired');
  });
});
