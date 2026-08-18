import { describe, it, expect } from 'vitest';
import { parseVoiceInvoice, generateInvoiceNumber } from '@/lib/voiceParser';

describe('parseVoiceInvoice', () => {
  it('parses a simple voice invoice', () => {
    const result = parseVoiceInvoice('Invoice for John Smith furnace repair for 250 dollars tax 8%');
    expect(result.clientName).toBeTruthy();
    expect(result.taxRate).toBe(8);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].unit_price).toBe(250);
  });

  it('handles empty transcript', () => {
    const result = parseVoiceInvoice('');
    expect(result.items).toEqual([]);
    expect(result.clientName).toBeNull();
    expect(result.taxRate).toBeNull();
  });

  it('extracts discount', () => {
    const result = parseVoiceInvoice('For Jane Doe, labor for 100 dollars, discount 20');
    expect(result.discount).toBe(20);
  });

  it('extracts notes', () => {
    const result = parseVoiceInvoice('For Bob, repair for 50 dollars, note: payment due in 30 days');
    expect(result.notes).toContain('payment due in 30 days');
  });

  it('defaults unit_price to 0 when no price detected', () => {
    const result = parseVoiceInvoice('For Bob, diagnostic service');
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].unit_price).toBe(0);
  });

  it('extracts multiple items', () => {
    const result = parseVoiceInvoice('For Bob, filter for 35 dollars, add labor for 95 dollars, plus disposal for 50 dollars');
    expect(result.items.length).toBeGreaterThanOrEqual(2);
  });
});

describe('generateInvoiceNumber', () => {
  it('pads numbers to 4 digits', () => {
    expect(generateInvoiceNumber('INV', 1)).toBe('INV-0001');
    expect(generateInvoiceNumber('INV', 42)).toBe('INV-0042');
    expect(generateInvoiceNumber('INV', 9999)).toBe('INV-9999');
  });

  it('handles large numbers', () => {
    expect(generateInvoiceNumber('INV', 10000)).toBe('INV-10000');
  });

  it('uses custom prefix', () => {
    expect(generateInvoiceNumber('EST', 5)).toBe('EST-0005');
  });
});
