import { describe, it, expect } from 'vitest';
import {
  buildDeliveryTimeline, getLatestVerifiedStage, getUnverifiedStages,
  STAGE_ORDER,
} from '@/lib/deliveryTimeline';
import type { Invoice, InvoicePayment } from '@/lib/types';

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv1',
    user_id: 'u1',
    invoice_number: 'INV-0001',
    client_id: null,
    client_name: 'Test Client',
    client_email: null,
    client_phone: null,
    client_address: null,
    work_order_number: null,
    technician_name: null,
    status: 'draft',
    issue_date: '2026-01-01',
    due_date: '2026-01-31',
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
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('buildDeliveryTimeline', () => {
  it('always shows "created" as verified', () => {
    const timeline = buildDeliveryTimeline(makeInvoice());
    expect(timeline[0].stage).toBe('created');
    expect(timeline[0].verified).toBe(true);
    expect(timeline[0].completed).toBe(true);
    expect(timeline[0].timestamp).toBe('2026-01-01T10:00:00Z');
  });

  it('shows "sent" as verified when status is sent', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'sent' }));
    const sentEvent = timeline.find(e => e.stage === 'sent')!;
    expect(sentEvent.verified).toBe(true);
    expect(sentEvent.completed).toBe(true);
  });

  it('shows "sent" as verified when status is overdue', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'overdue' }));
    const sentEvent = timeline.find(e => e.stage === 'sent')!;
    expect(sentEvent.verified).toBe(true);
  });

  it('shows "sent" as verified when status is paid', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'paid', payment_status: 'paid' }));
    const sentEvent = timeline.find(e => e.stage === 'sent')!;
    expect(sentEvent.verified).toBe(true);
  });

  it('shows "sent" as NOT verified when status is draft', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'draft' }));
    const sentEvent = timeline.find(e => e.stage === 'sent')!;
    expect(sentEvent.verified).toBe(false);
    expect(sentEvent.completed).toBe(false);
  });

  it('never fabricates "delivered" without tracking data', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'sent' }));
    const deliveredEvent = timeline.find(e => e.stage === 'delivered')!;
    expect(deliveredEvent.verified).toBe(false);
    expect(deliveredEvent.completed).toBe(false);
    expect(deliveredEvent.timestamp).toBeNull();
  });

  it('never fabricates "opened" without tracking data', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'sent' }));
    const openedEvent = timeline.find(e => e.stage === 'opened')!;
    expect(openedEvent.verified).toBe(false);
    expect(openedEvent.completed).toBe(false);
    expect(openedEvent.timestamp).toBeNull();
  });

  it('shows "delivered" as verified when metadata has delivery_confirmed', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({
      status: 'sent',
      metadata: { delivery_confirmed: '2026-01-02T12:00:00Z' },
    }));
    const deliveredEvent = timeline.find(e => e.stage === 'delivered')!;
    expect(deliveredEvent.verified).toBe(true);
    expect(deliveredEvent.completed).toBe(true);
    expect(deliveredEvent.timestamp).toBe('2026-01-02T12:00:00Z');
  });

  it('shows "opened" as verified when metadata has opened_at', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({
      status: 'sent',
      metadata: { opened_at: '2026-01-03T09:00:00Z' },
    }));
    const openedEvent = timeline.find(e => e.stage === 'opened')!;
    expect(openedEvent.verified).toBe(true);
    expect(openedEvent.timestamp).toBe('2026-01-03T09:00:00Z');
  });

  it('shows "paid" as verified when payment_status is paid', () => {
    const payment: InvoicePayment = {
      id: 'p1', invoice_id: 'inv1', user_id: 'u1', amount: 100,
      method: 'card', reference: null, paid_at: '2026-01-05T14:00:00Z',
      notes: null, created_at: '', updated_at: '',
    };
    const timeline = buildDeliveryTimeline(makeInvoice({
      status: 'paid',
      payment_status: 'paid',
      invoice_payments: [payment],
    }));
    const paidEvent = timeline.find(e => e.stage === 'paid')!;
    expect(paidEvent.verified).toBe(true);
    expect(paidEvent.completed).toBe(true);
    expect(paidEvent.timestamp).toBe('2026-01-05T14:00:00Z');
  });

  it('shows "paid" as verified with "Partially paid" label when partial', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({
      status: 'sent',
      payment_status: 'partial',
    }));
    const paidEvent = timeline.find(e => e.stage === 'paid')!;
    expect(paidEvent.verified).toBe(true);
    expect(paidEvent.label).toBe('Partially paid');
  });

  it('has all 5 stages in order', () => {
    const timeline = buildDeliveryTimeline(makeInvoice());
    expect(timeline.map(e => e.stage)).toEqual(STAGE_ORDER);
  });
});

describe('getLatestVerifiedStage', () => {
  it('returns "created" for a draft invoice', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'draft' }));
    expect(getLatestVerifiedStage(timeline)).toBe('created');
  });

  it('returns "sent" for a sent invoice', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'sent' }));
    expect(getLatestVerifiedStage(timeline)).toBe('sent');
  });

  it('returns "paid" for a paid invoice', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'paid', payment_status: 'paid' }));
    expect(getLatestVerifiedStage(timeline)).toBe('paid');
  });
});

describe('getUnverifiedStages', () => {
  it('returns sent/delivered/opened/paid for a draft', () => {
    const timeline = buildDeliveryTimeline(makeInvoice({ status: 'draft' }));
    const unverified = getUnverifiedStages(timeline);
    expect(unverified).toContain('sent');
    expect(unverified).toContain('delivered');
    expect(unverified).toContain('opened');
    expect(unverified).toContain('paid');
  });

  it('does not include created in unverified', () => {
    const timeline = buildDeliveryTimeline(makeInvoice());
    const unverified = getUnverifiedStages(timeline);
    expect(unverified).not.toContain('created');
  });
});
