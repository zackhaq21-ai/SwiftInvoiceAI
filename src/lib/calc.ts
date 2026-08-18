import type { InvoiceItem } from './types';

export function calcItemTotal(item: Pick<InvoiceItem, 'quantity' | 'unit_price'> & { discount_amount?: number | null }): number {
  const gross = (item.quantity || 0) * (item.unit_price || 0);
  const pct = item.discount_amount || 0;
  return round2(gross * (1 - pct / 100));
}

export function calcSubtotal(items: InvoiceItem[]): number {
  return round2(items.reduce((sum, item) => sum + calcItemTotal(item), 0));
}

export function calcItemTax(item: InvoiceItem, invoiceTaxRate: number): number {
  const lineNet = calcItemTotal(item);
  const rate = item.tax_rate !== null && item.tax_rate !== undefined ? item.tax_rate : invoiceTaxRate;
  return round2((lineNet * (rate || 0)) / 100);
}

export function calcTaxAmount(items: InvoiceItem[], invoiceTaxRate: number, _discountPct?: number): number {
  void _discountPct;
  const perItemTax = items.reduce((sum, item) => sum + calcItemTax(item, invoiceTaxRate), 0);
  return round2(perItemTax);
}

export function calcTotal(
  subtotal: number,
  taxAmount: number,
  discountPct: number,
  fees = 0,
  shipping = 0,
): number {
  const discountAmount = round2(subtotal * (discountPct || 0) / 100);
  return round2(subtotal - discountAmount + taxAmount + (fees || 0) + (shipping || 0));
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  shipping: number;
  deposit: number;
  balanceDue: number;
}

export function recalcInvoice(
  items: InvoiceItem[],
  taxRate: number,
  discountPct: number,
  fees = 0,
  shipping = 0,
  deposit = 0,
): InvoiceTotals {
  const subtotal = calcSubtotal(items);
  const taxAmount = calcTaxAmount(items, taxRate, discountPct);
  const discountAmount = round2(subtotal * (discountPct || 0) / 100);
  const total = calcTotal(subtotal, taxAmount, discountPct, fees, shipping);
  const balanceDue = round2(total - (deposit || 0));
  return { subtotal, taxAmount, discountAmount, total, shipping, deposit: deposit || 0, balanceDue };
}
