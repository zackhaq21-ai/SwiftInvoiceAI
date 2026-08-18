import { describe, it, expect } from 'vitest';
import { mapPriceIdToPlan, isActuallyPaid } from '@/lib/paidCustomers';

describe('mapPriceIdToPlan', () => {
  const validMap: Record<string, string> = {
    price_abc123: 'Pro',
    price_def456: 'Business',
    price_ghi789: 'Enterprise',
  };

  it('maps a known Pro price ID to "Pro"', () => {
    expect(mapPriceIdToPlan('price_abc123', validMap)).toBe('Pro');
  });

  it('maps a known Business price ID to "Business"', () => {
    expect(mapPriceIdToPlan('price_def456', validMap)).toBe('Business');
  });

  it('maps a known Enterprise price ID to "Enterprise"', () => {
    expect(mapPriceIdToPlan('price_ghi789', validMap)).toBe('Enterprise');
  });

  it('returns "Unknown" for an unrecognized price ID', () => {
    expect(mapPriceIdToPlan('price_unknown', validMap)).toBe('Unknown');
  });

  it('returns "Unknown" for an empty price ID', () => {
    expect(mapPriceIdToPlan('', validMap)).toBe('Unknown');
  });

  it('returns "Unknown" when price map is empty', () => {
    expect(mapPriceIdToPlan('price_abc123', {})).toBe('Unknown');
  });
});

describe('isActuallyPaid', () => {
  it('returns true when invoice status is paid and amount > 0', () => {
    expect(isActuallyPaid('paid', 1499)).toBe(true);
  });

  it('returns false when invoice status is paid but amount is 0', () => {
    expect(isActuallyPaid('paid', 0)).toBe(false);
  });

  it('returns false when invoice status is null', () => {
    expect(isActuallyPaid(null, 1499)).toBe(false);
  });

  it('returns false when invoice status is open', () => {
    expect(isActuallyPaid('open', 1499)).toBe(false);
  });

  it('returns false when invoice status is void', () => {
    expect(isActuallyPaid('void', 1499)).toBe(false);
  });

  it('returns false when invoice status is uncollectible', () => {
    expect(isActuallyPaid('uncollectible', 1499)).toBe(false);
  });

  it('returns false when both status and amount are empty', () => {
    expect(isActuallyPaid('', 0)).toBe(false);
  });

  it('returns true for paid with very small positive amount (1 cent)', () => {
    expect(isActuallyPaid('paid', 1)).toBe(true);
  });

  it('returns false for negative amount even if status is paid', () => {
    expect(isActuallyPaid('paid', -100)).toBe(false);
  });
});
