import { describe, it, expect } from 'vitest';
import { computeReportMetrics, computeMonthlyRevenue, computeClientSummary } from '@/lib/reports';
import type { Invoice, InvoicePayment } from '@/lib/types';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-' + Math.random().toString(36).slice(2),
    user_id: 'u1',
    invoice_number: 'INV-001',
    client_id: null,
    client_name: 'Client A',
    client_email: null,
    client_phone: null,
    client_address: null,
    work_order_number: null,
    technician_name: null,
    status: 'draft',
    issue_date: '2026-01-15',
    due_date: '2026-02-15',
    subtotal: 100,
    tax_rate: 0,
    tax_amount: 0,
    discount_amount: 0,
    fees_amount: 0,
    total: 100,
    notes: null,
    terms: null,
    warranty: null,
    metadata: null,
    industry_template: null,
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
    payment_status: 'unpaid',
    hearth_status: null,
    hearth_application_url: null,
    document_type: 'invoice',
    parent_invoice_id: null,
    estimate_number: null,
    deposit_amount: 0,
    shipping_amount: 0,
    recurring_enabled: false,
    recurring_interval: null,
    recurring_next_date: null,
    converted_at: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

function makePayment(amount: number, paidAt: string): InvoicePayment {
  return {
    id: 'p-' + Math.random().toString(36).slice(2),
    invoice_id: 'inv1',
    user_id: 'u1',
    amount,
    method: 'card',
    reference: null,
    paid_at: paidAt,
    notes: null,
    created_at: paidAt,
    updated_at: paidAt,
  };
}

describe('computeReportMetrics', () => {
  it('returns zeros for empty array', () => {
    const metrics = computeReportMetrics([]);
    expect(metrics.totalRevenue).toBe(0);
    expect(metrics.outstanding).toBe(0);
    expect(metrics.overdue).toBe(0);
    expect(metrics.paidCount).toBe(0);
    expect(metrics.avgTimeToPay).toBeNull();
    expect(metrics.estimateConversionRate).toBe(0);
  });

  it('counts paid invoice revenue', () => {
    const inv = makeInvoice({
      status: 'paid',
      payment_status: 'paid',
      total: 500,
      invoice_payments: [makePayment(500, '2026-01-20T12:00:00Z')],
    });
    const metrics = computeReportMetrics([inv]);
    expect(metrics.totalRevenue).toBe(500);
    expect(metrics.paidCount).toBe(1);
  });

  it('counts outstanding for sent (unpaid) invoices', () => {
    const inv = makeInvoice({ status: 'sent', payment_status: 'unpaid', total: 300 });
    const metrics = computeReportMetrics([inv]);
    expect(metrics.outstanding).toBe(300);
  });

  it('does not count draft invoices as outstanding', () => {
    const inv = makeInvoice({ status: 'draft', payment_status: 'unpaid', total: 200 });
    const metrics = computeReportMetrics([inv]);
    expect(metrics.outstanding).toBe(0);
  });

  it('counts overdue amount and count', () => {
    const inv = makeInvoice({ status: 'overdue', payment_status: 'unpaid', total: 250 });
    const metrics = computeReportMetrics([inv]);
    expect(metrics.overdue).toBe(250);
    expect(metrics.overdueCount).toBe(1);
  });

  it('calculates avg time to pay from payments', () => {
    const inv = makeInvoice({
      status: 'paid',
      payment_status: 'paid',
      total: 100,
      created_at: '2026-01-10T10:00:00Z',
      invoice_payments: [makePayment(100, '2026-01-15T10:00:00Z')],
    });
    const metrics = computeReportMetrics([inv]);
    expect(metrics.avgTimeToPay).toBe(5);
  });

  it('calculates avg time to pay across multiple invoices', () => {
    const inv1 = makeInvoice({
      status: 'paid', payment_status: 'paid', total: 100,
      created_at: '2026-01-10T10:00:00Z',
      invoice_payments: [makePayment(100, '2026-01-15T10:00:00Z')],
    });
    const inv2 = makeInvoice({
      status: 'paid', payment_status: 'paid', total: 200,
      created_at: '2026-02-01T10:00:00Z',
      invoice_payments: [makePayment(200, '2026-02-11T10:00:00Z')],
    });
    const metrics = computeReportMetrics([inv1, inv2]);
    expect(metrics.avgTimeToPay).toBe(8); // (5 + 10) / 2 = 7.5 -> 8
  });

  it('returns null avgTimeToPay when no paid invoices', () => {
    const inv = makeInvoice({ status: 'sent', payment_status: 'unpaid' });
    const metrics = computeReportMetrics([inv]);
    expect(metrics.avgTimeToPay).toBeNull();
  });

  it('counts partial payment revenue and outstanding', () => {
    const inv = makeInvoice({
      status: 'sent', payment_status: 'partial', total: 200,
      invoice_payments: [makePayment(75, '2026-01-20T12:00:00Z')],
    });
    const metrics = computeReportMetrics([inv]);
    expect(metrics.totalRevenue).toBe(75);
    expect(metrics.outstanding).toBe(125);
  });

  it('calculates estimate conversion rate', () => {
    const est1 = makeInvoice({ document_type: 'estimate', status: 'sent' });
    const est2 = makeInvoice({ document_type: 'estimate', status: 'sent', converted_at: '2026-01-20T12:00:00Z' });
    const est3 = makeInvoice({ document_type: 'estimate', status: 'sent', converted_at: '2026-01-21T12:00:00Z' });
    const metrics = computeReportMetrics([est1, est2, est3]);
    expect(metrics.estimatesCount).toBe(3);
    expect(metrics.estimateConversionRate).toBe(67); // 2/3 = 66.67 -> 67
  });

  it('returns 0 conversion rate when no estimates', () => {
    const metrics = computeReportMetrics([]);
    expect(metrics.estimateConversionRate).toBe(0);
  });

  it('counts total invoices and estimates separately', () => {
    const inv = makeInvoice({ document_type: 'invoice' });
    const est = makeInvoice({ document_type: 'estimate' });
    const metrics = computeReportMetrics([inv, est]);
    expect(metrics.totalInvoices).toBe(1);
    expect(metrics.estimatesCount).toBe(1);
  });
});

describe('computeMonthlyRevenue', () => {
  it('returns 6 months by default', () => {
    const result = computeMonthlyRevenue([]);
    expect(result).toHaveLength(6);
  });

  it('attributes revenue to the month payment was received', () => {
    const inv = makeInvoice({
      status: 'paid', payment_status: 'paid', total: 500,
      invoice_payments: [makePayment(500, new Date().toISOString())],
    });
    const result = computeMonthlyRevenue([inv]);
    const lastMonth = result[result.length - 1];
    expect(lastMonth.revenue).toBe(500);
  });

  it('returns zero revenue for months with no payments', () => {
    const result = computeMonthlyRevenue([]);
    result.forEach(m => expect(m.revenue).toBe(0));
  });
});

describe('computeClientSummary', () => {
  it('groups by client name', () => {
    const inv1 = makeInvoice({ client_name: 'Alice', total: 200, status: 'paid', payment_status: 'paid' });
    const inv2 = makeInvoice({ client_name: 'Bob', total: 150, status: 'sent', payment_status: 'unpaid' });
    const inv3 = makeInvoice({ client_name: 'Alice', total: 100, status: 'sent', payment_status: 'unpaid' });
    const summaries = computeClientSummary([inv1, inv2, inv3]);
    expect(summaries).toHaveLength(2);
    const alice = summaries.find(s => s.clientName === 'Alice')!;
    expect(alice.totalBilled).toBe(300);
    expect(alice.totalPaid).toBe(200);
    expect(alice.outstanding).toBe(100);
    expect(alice.invoiceCount).toBe(2);
  });

  it('sorts by total billed descending', () => {
    const inv1 = makeInvoice({ client_name: 'Small', total: 50 });
    const inv2 = makeInvoice({ client_name: 'Big', total: 500 });
    const summaries = computeClientSummary([inv1, inv2]);
    expect(summaries[0].clientName).toBe('Big');
  });

  it('handles unknown client name', () => {
    const inv = makeInvoice({ client_name: null, total: 100 });
    const summaries = computeClientSummary([inv]);
    expect(summaries[0].clientName).toBe('Unknown');
  });
});
