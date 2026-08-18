import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  todayISO,
  addDays,
  statusColor,
  relativeTime,
} from '@/lib/format';

describe('formatCurrency', () => {
  it('formats positive numbers', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(formatCurrency(0)).toBe('$0.00');
    expect(formatCurrency(99.99)).toBe('$99.99');
  });

  it('handles custom symbols', () => {
    expect(formatCurrency(100, '€')).toBe('€100.00');
    expect(formatCurrency(100, '£')).toBe('£100.00');
  });

  it('handles non-finite values safely', () => {
    expect(formatCurrency(NaN)).toBe('$0.00');
    expect(formatCurrency(Infinity)).toBe('$0.00');
    expect(formatCurrency(-Infinity)).toBe('$0.00');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-50)).toBe('$-50.00');
  });
});

describe('formatDate', () => {
  it('formats valid dates', () => {
    expect(formatDate('2026-01-15')).toBe('Jan 15, 2026');
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
  });

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns dash for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
});

describe('todayISO', () => {
  it('returns a valid ISO date string', () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('addDays', () => {
  it('adds days correctly', () => {
    expect(addDays('2026-01-01', 7)).toBe('2026-01-08');
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('handles negative days (subtraction)', () => {
    expect(addDays('2026-01-08', -7)).toBe('2026-01-01');
  });
});

describe('statusColor', () => {
  it('returns colors for known statuses', () => {
    expect(statusColor('paid').dot).toBe('bg-emerald-500');
    expect(statusColor('sent').dot).toBe('bg-slate-500');
    expect(statusColor('overdue').dot).toBe('bg-red-500');
    expect(statusColor('draft').dot).toBe('bg-gray-400');
  });

  it('defaults to draft styling for unknown statuses', () => {
    expect(statusColor('unknown').dot).toBe('bg-gray-400');
  });
});

describe('relativeTime', () => {
  it('returns Today for current date', () => {
    expect(relativeTime(new Date().toISOString())).toBe('Today');
  });

  it('returns Yesterday for 1 day ago', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(relativeTime(yesterday.toISOString())).toBe('Yesterday');
  });

  it('returns days ago for recent dates', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(relativeTime(threeDaysAgo.toISOString())).toBe('3 days ago');
  });
});
