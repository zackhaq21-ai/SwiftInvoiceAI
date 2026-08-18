import { describe, it, expect } from 'vitest';
import {
  getCancellationEligibility,
  formatPeriodEnd,
  isCancellationPending,
} from '@/lib/cancellation';

describe('getCancellationEligibility', () => {
  it('admin accounts cannot cancel', () => {
    const result = getCancellationEligibility('admin', false, 'active');
    expect(result.canCancel).toBe(false);
    expect(result.canResume).toBe(false);
    expect(result.reason).toContain('Admin');
  });

  it('free users cannot cancel', () => {
    const result = getCancellationEligibility('free', false, 'active');
    expect(result.canCancel).toBe(false);
    expect(result.canResume).toBe(false);
    expect(result.reason).toContain('Free');
  });

  it('active pro subscriber can cancel', () => {
    const result = getCancellationEligibility('pro', false, 'active');
    expect(result.canCancel).toBe(true);
    expect(result.canResume).toBe(false);
  });

  it('active business subscriber can cancel', () => {
    const result = getCancellationEligibility('business', false, 'active');
    expect(result.canCancel).toBe(true);
    expect(result.canResume).toBe(false);
  });

  it('active enterprise subscriber can cancel', () => {
    const result = getCancellationEligibility('enterprise', false, 'active');
    expect(result.canCancel).toBe(true);
    expect(result.canResume).toBe(false);
  });

  it('trialing subscriber can cancel', () => {
    const result = getCancellationEligibility('pro', false, 'trialing');
    expect(result.canCancel).toBe(true);
  });

  it('subscriber with scheduled cancellation can resume but not cancel again', () => {
    const result = getCancellationEligibility('pro', true, 'active');
    expect(result.canCancel).toBe(false);
    expect(result.canResume).toBe(true);
  });

  it('past_due subscription cannot be cancelled', () => {
    const result = getCancellationEligibility('pro', false, 'past_due');
    expect(result.canCancel).toBe(false);
    expect(result.reason).toContain('past_due');
  });

  it('canceled subscription cannot be cancelled again', () => {
    const result = getCancellationEligibility('pro', false, 'canceled');
    expect(result.canCancel).toBe(false);
    expect(result.reason).toContain('canceled');
  });

  it('unpaid subscription cannot be cancelled', () => {
    const result = getCancellationEligibility('business', false, 'unpaid');
    expect(result.canCancel).toBe(false);
  });

  it('null status with paid tier can cancel', () => {
    const result = getCancellationEligibility('pro', false, null);
    expect(result.canCancel).toBe(true);
  });

  it('cancelled subscription status cannot cancel or resume', () => {
    const result = getCancellationEligibility('pro', false, 'cancelled');
    expect(result.canCancel).toBe(false);
    expect(result.canResume).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('incomplete status cannot cancel', () => {
    const result = getCancellationEligibility('business', false, 'incomplete');
    expect(result.canCancel).toBe(false);
  });

  it('incomplete_expired status cannot cancel', () => {
    const result = getCancellationEligibility('enterprise', false, 'incomplete_expired');
    expect(result.canCancel).toBe(false);
  });

  it('paused status cannot cancel', () => {
    const result = getCancellationEligibility('pro', false, 'paused');
    expect(result.canCancel).toBe(false);
  });

  it('business with scheduled cancellation can resume', () => {
    const result = getCancellationEligibility('business', true, 'active');
    expect(result.canCancel).toBe(false);
    expect(result.canResume).toBe(true);
  });

  it('enterprise with scheduled cancellation can resume', () => {
    const result = getCancellationEligibility('enterprise', true, 'active');
    expect(result.canCancel).toBe(false);
    expect(result.canResume).toBe(true);
  });
});

describe('formatPeriodEnd', () => {
  it('formats ISO date string', () => {
    const result = formatPeriodEnd('2026-12-31T23:59:59Z');
    expect(result).toBeTruthy();
    expect(result).toMatch(/2026/);
  });

  it('returns null for null input', () => {
    expect(formatPeriodEnd(null)).toBeNull();
  });

  it('returns null for invalid date', () => {
    expect(formatPeriodEnd('not-a-date')).toBeNull();
  });
});

describe('isCancellationPending', () => {
  it('returns true when cancel_at_period_end is true', () => {
    expect(isCancellationPending({ cancel_at_period_end: true })).toBe(true);
  });

  it('returns false when cancel_at_period_end is false', () => {
    expect(isCancellationPending({ cancel_at_period_end: false })).toBe(false);
  });

  it('returns false when subscription is null', () => {
    expect(isCancellationPending(null)).toBe(false);
  });

  it('returns false when cancel_at_period_end is undefined', () => {
    expect(isCancellationPending({})).toBe(false);
  });
});
