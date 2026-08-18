import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  emptyDraft, emptyItem, stepFromValidation, calcDraftTotals,
  clientFromDraft, invoiceInsertFromDraft, itemsForInsert,
  saveDraftToStorage, loadDraftFromStorage, clearDraftFromStorage,
  hasAutosavedDraft, STEP_LABELS,
} from '@/lib/quickInvoice';
import type { BusinessProfile } from '@/lib/types';

const mockProfile = {
  id: 'p1', user_id: 'u1', name: 'Test Biz', email: null, phone: null,
  address: null, logo_url: null, tax_rate: 8.5, currency: 'USD',
  currency_symbol: '$', invoice_prefix: 'INV', next_invoice_number: 1,
  notes: null, accent_color: '#111827', business_type: 'services',
  industry_template: 'general', payments_enabled: false,
  hearth_merchant_url: null, hearth_enabled: false,
  created_at: '', updated_at: '',
} as BusinessProfile;

describe('emptyDraft', () => {
  it('creates a draft with default values from profile', () => {
    const draft = emptyDraft(mockProfile);
    expect(draft.taxRate).toBe(8.5);
    expect(draft.issueDate).toBeTruthy();
    expect(draft.dueDate).toBeTruthy();
    expect(draft.documentType).toBe('invoice');
    expect(draft.items).toHaveLength(1);
  });

  it('creates a draft with defaults when no profile', () => {
    const draft = emptyDraft(null);
    expect(draft.taxRate).toBe(0);
    expect(draft.items).toHaveLength(1);
  });
});

describe('STEP_LABELS', () => {
  it('has 5 steps', () => {
    expect(STEP_LABELS).toHaveLength(5);
    expect(STEP_LABELS[0]).toBe('Client');
    expect(STEP_LABELS[4]).toBe('Send');
  });
});

describe('stepFromValidation', () => {
  it('step 0 requires client selection or name', () => {
    const draft = emptyDraft(mockProfile);
    const result = stepFromValidation(0, draft);
    expect(result.canAdvance).toBe(false);
    expect(result.reason).toContain('client');
  });

  it('step 0 passes with new client name', () => {
    const draft = { ...emptyDraft(mockProfile), newClientName: 'John' };
    const result = stepFromValidation(0, draft);
    expect(result.canAdvance).toBe(true);
  });

  it('step 0 passes with existing client ID', () => {
    const draft = { ...emptyDraft(mockProfile), clientId: 'c1' };
    const result = stepFromValidation(0, draft);
    expect(result.canAdvance).toBe(true);
  });

  it('step 1 requires at least one valid item', () => {
    const draft = { ...emptyDraft(mockProfile), newClientName: 'John' };
    const result = stepFromValidation(1, draft);
    expect(result.canAdvance).toBe(false);
  });

  it('step 1 passes with a valid item', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      newClientName: 'John',
      items: [{
        ...emptyItem(),
        description: 'Test service',
        quantity: 2,
        unit_price: 50,
        total: 100,
      }],
    };
    const result = stepFromValidation(1, draft);
    expect(result.canAdvance).toBe(true);
  });

  it('step 1 fails with item but no description', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      items: [{ ...emptyItem(), quantity: 2, unit_price: 50, total: 0 }],
    };
    const result = stepFromValidation(1, draft);
    expect(result.canAdvance).toBe(false);
  });

  it('step 2 requires issue date', () => {
    const draft = { ...emptyDraft(mockProfile), issueDate: '' };
    const result = stepFromValidation(2, draft);
    expect(result.canAdvance).toBe(false);
    expect(result.reason).toContain('Issue date');
  });

  it('step 2 requires due date for invoices', () => {
    const draft = { ...emptyDraft(mockProfile), dueDate: '', documentType: 'invoice' as const };
    const result = stepFromValidation(2, draft);
    expect(result.canAdvance).toBe(false);
    expect(result.reason).toContain('Due date');
  });

  it('step 2 does not require due date for estimates', () => {
    const draft = { ...emptyDraft(mockProfile), dueDate: '', documentType: 'estimate' as const };
    const result = stepFromValidation(2, draft);
    expect(result.canAdvance).toBe(true);
  });
});

describe('calcDraftTotals', () => {
  it('calculates totals correctly', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      items: [
        { ...emptyItem(), description: 'A', quantity: 2, unit_price: 50, total: 100 },
        { ...emptyItem(), description: 'B', quantity: 1, unit_price: 75, total: 75 },
      ],
      taxRate: 10,
      discountPct: 0,
    };
    const totals = calcDraftTotals(draft);
    expect(totals.subtotal).toBe(175);
    expect(totals.taxAmount).toBe(17.5);
    expect(totals.total).toBe(192.5);
  });

  it('applies discount correctly', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      items: [
        { ...emptyItem(), description: 'A', quantity: 1, unit_price: 100, total: 100 },
      ],
      taxRate: 0,
      discountPct: 10,
    };
    const totals = calcDraftTotals(draft);
    expect(totals.subtotal).toBe(100);
    expect(totals.discountAmount).toBe(10);
    expect(totals.total).toBe(90);
  });
});

describe('clientFromDraft', () => {
  it('returns null when no new client name', () => {
    const draft = emptyDraft(mockProfile);
    expect(clientFromDraft(draft)).toBeNull();
  });

  it('returns client data when new client name exists', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      newClientName: 'Jane Doe',
      newClientEmail: 'jane@test.com',
      newClientPhone: '555-1234',
    };
    const client = clientFromDraft(draft);
    expect(client).not.toBeNull();
    expect(client!.name).toBe('Jane Doe');
    expect(client!.email).toBe('jane@test.com');
    expect(client!.phone).toBe('555-1234');
  });
});

describe('itemsForInsert', () => {
  it('filters out items without description', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      items: [
        { ...emptyItem(), description: 'Valid', quantity: 1, unit_price: 50, total: 50 },
        { ...emptyItem(), description: '', quantity: 1, unit_price: 0, total: 0 },
      ],
    };
    const items = itemsForInsert(draft);
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Valid');
  });

  it('assigns sort_order sequentially', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      items: [
        { ...emptyItem(), description: 'A', quantity: 1, unit_price: 10, total: 10 },
        { ...emptyItem(), description: 'B', quantity: 2, unit_price: 20, total: 40 },
        { ...emptyItem(), description: 'C', quantity: 1, unit_price: 30, total: 30 },
      ],
    };
    const items = itemsForInsert(draft);
    expect(items[0].sort_order).toBe(0);
    expect(items[1].sort_order).toBe(1);
    expect(items[2].sort_order).toBe(2);
  });
});

describe('autosave storage', () => {
  beforeEach(() => {
    clearDraftFromStorage();
  });

  afterEach(() => {
    clearDraftFromStorage();
  });

  it('returns null when no draft saved', () => {
    expect(loadDraftFromStorage()).toBeNull();
    expect(hasAutosavedDraft()).toBe(false);
  });

  it('saves and loads a draft', () => {
    const draft = { ...emptyDraft(mockProfile), newClientName: 'Saved Client' };
    saveDraftToStorage(draft);
    expect(hasAutosavedDraft()).toBe(true);
    const loaded = loadDraftFromStorage();
    expect(loaded).not.toBeNull();
    expect(loaded!.newClientName).toBe('Saved Client');
  });

  it('clears draft from storage', () => {
    const draft = emptyDraft(mockProfile);
    saveDraftToStorage(draft);
    expect(hasAutosavedDraft()).toBe(true);
    clearDraftFromStorage();
    expect(hasAutosavedDraft()).toBe(false);
  });

  it('returns null for invalid JSON', () => {
    localStorage.setItem('swift_invoice_quick_draft', 'not-json');
    expect(loadDraftFromStorage()).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    localStorage.setItem('swift_invoice_quick_draft', '"string"');
    expect(loadDraftFromStorage()).toBeNull();
  });
});

describe('invoiceInsertFromDraft', () => {
  it('creates invoice data with correct fields', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      newClientName: 'Test Client',
      items: [
        { ...emptyItem(), description: 'Service', quantity: 1, unit_price: 100, total: 100 },
      ],
      taxRate: 10,
      discountPct: 0,
    };
    const invoiceData = invoiceInsertFromDraft(draft, mockProfile, 'INV-0001');
    expect(invoiceData.invoice_number).toBe('INV-0001');
    expect(invoiceData.document_type).toBe('invoice');
    expect(invoiceData.status).toBe('draft');
    expect(invoiceData.subtotal).toBe(100);
    expect(invoiceData.tax_amount).toBe(10);
    expect(invoiceData.total).toBe(110);
  });

  it('sets estimate_number for estimates', () => {
    const draft = {
      ...emptyDraft(mockProfile),
      newClientName: 'Test Client',
      documentType: 'estimate' as const,
      items: [{ ...emptyItem(), description: 'Service', quantity: 1, unit_price: 100, total: 100 }],
    };
    const invoiceData = invoiceInsertFromDraft(draft, mockProfile, 'EST-0001');
    expect(invoiceData.document_type).toBe('estimate');
    expect(invoiceData.estimate_number).toBe('EST-0001');
    expect(invoiceData.due_date).toBeNull();
  });
});
