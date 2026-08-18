import { describe, it, expect } from 'vitest';
import {
  calcItemTotal,
  calcSubtotal,
  calcTaxAmount,
  calcTotal,
  recalcInvoice,
  round2,
} from '@/lib/calc';
import type { InvoiceItem } from '@/lib/types';

function makeItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: 'test-id',
    invoice_id: 'inv-1',
    user_id: 'user-1',
    description: 'Test item',
    quantity: 1,
    unit_price: 100,
    tax_rate: null,
    discount_amount: 0,
    sort_order: 0,
    created_at: '',
    updated_at: '',
    total: 0,
    ...overrides,
  } as InvoiceItem;
}

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('handles edge cases', () => {
    expect(round2(0)).toBe(0);
    expect(round2(-1.005)).toBe(-1);
    expect(round2(NaN)).toBe(NaN);
  });
});

describe('calcItemTotal', () => {
  it('calculates basic item total', () => {
    const item = makeItem({ quantity: 3, unit_price: 50 });
    expect(calcItemTotal(item)).toBe(150);
  });

  it('applies discount percentage', () => {
    const item = makeItem({ quantity: 2, unit_price: 100, discount_amount: 10 });
    expect(calcItemTotal(item)).toBe(180);
  });

  it('handles zero quantity', () => {
    const item = makeItem({ quantity: 0, unit_price: 100 });
    expect(calcItemTotal(item)).toBe(0);
  });

  it('handles zero price', () => {
    const item = makeItem({ quantity: 5, unit_price: 0 });
    expect(calcItemTotal(item)).toBe(0);
  });

  it('handles null/undefined values safely', () => {
    const item = makeItem({ quantity: null as unknown as number, unit_price: null as unknown as number });
    expect(calcItemTotal(item)).toBe(0);
  });
});

describe('calcSubtotal', () => {
  it('sums item totals', () => {
    const items = [
      makeItem({ quantity: 2, unit_price: 50 }),
      makeItem({ quantity: 1, unit_price: 100 }),
    ];
    expect(calcSubtotal(items)).toBe(200);
  });

  it('handles empty array', () => {
    expect(calcSubtotal([])).toBe(0);
  });
});

describe('calcTaxAmount', () => {
  it('calculates tax for items without per-item tax', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, tax_rate: null })];
    expect(calcTaxAmount(items, 10, 0)).toBe(10);
  });

  it('uses per-item tax rate when set', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, tax_rate: 20 })];
    expect(calcTaxAmount(items, 10, 0)).toBe(20);
  });

  it('handles zero tax rate', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })];
    expect(calcTaxAmount(items, 0, 0)).toBe(0);
  });
});

describe('calcTotal', () => {
  it('calculates total with tax, no discount', () => {
    expect(calcTotal(100, 10, 0)).toBe(110);
  });

  it('applies discount percentage', () => {
    expect(calcTotal(100, 10, 10)).toBe(100);
  });

  it('adds fees and shipping', () => {
    expect(calcTotal(100, 0, 0, 5, 10)).toBe(115);
  });
});

describe('recalcInvoice', () => {
  it('calculates all totals correctly', () => {
    const items = [
      makeItem({ quantity: 2, unit_price: 50 }),
      makeItem({ quantity: 1, unit_price: 100 }),
    ];
    const result = recalcInvoice(items, 10, 0, 0, 0, 50);
    expect(result.subtotal).toBe(200);
    expect(result.taxAmount).toBe(20);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(220);
    expect(result.deposit).toBe(50);
    expect(result.balanceDue).toBe(170);
  });

  it('handles empty items', () => {
    const result = recalcInvoice([], 10, 5);
    expect(result.subtotal).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.total).toBe(0);
    expect(result.balanceDue).toBe(0);
  });

  it('handles discount with tax', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })];
    const result = recalcInvoice(items, 10, 10);
    expect(result.subtotal).toBe(100);
    expect(result.discountAmount).toBe(10);
    expect(result.total).toBe(100);
  });
});
