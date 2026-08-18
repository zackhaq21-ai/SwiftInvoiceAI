import type { InvoiceItem, Client, Invoice, BusinessProfile, DocumentType } from './types';
import { recalcInvoice, round2 } from './calc';
import { todayISO, addDays } from './format';

export type QuickInvoiceStep = 0 | 1 | 2 | 3 | 4;

export interface QuickInvoiceDraft {
  clientId: string | null;
  newClientName: string;
  newClientEmail: string;
  newClientPhone: string;
  items: InvoiceItem[];
  taxRate: number;
  discountPct: number;
  notes: string;
  terms: string;
  issueDate: string;
  dueDate: string;
  documentType: DocumentType;
}

export const STEP_LABELS = ['Client', 'Items', 'Details', 'Review', 'Send'] as const;

export function emptyDraft(profile?: BusinessProfile | null): QuickInvoiceDraft {
  return {
    clientId: null,
    newClientName: '',
    newClientEmail: '',
    newClientPhone: '',
    items: [emptyItem(profile)],
    taxRate: profile?.tax_rate || 0,
    discountPct: 0,
    notes: '',
    terms: '',
    issueDate: todayISO(),
    dueDate: addDays(todayISO(), 30),
    documentType: 'invoice',
  };
}

export function emptyItem(_profile?: BusinessProfile | null): InvoiceItem {
  void _profile;
  return {
    description: '',
    quantity: 1,
    unit_price: 0,
    total: 0,
    sort_order: 0,
    item_type: 'service',
    unit: 'ea',
    tax_rate: null,
    discount_amount: 0,
    notes: null,
  };
}

export function stepFromValidation(step: QuickInvoiceStep, draft: QuickInvoiceDraft): { canAdvance: boolean; reason: string } {
  if (step === 0) {
    if (!draft.clientId && !draft.newClientName.trim()) {
      return { canAdvance: false, reason: 'Select a client or enter a name' };
    }
    return { canAdvance: true, reason: '' };
  }
  if (step === 1) {
    const validItems = draft.items.filter(i => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      return { canAdvance: false, reason: 'Add at least one item with a description and quantity' };
    }
    return { canAdvance: true, reason: '' };
  }
  if (step === 2) {
    if (!draft.issueDate) {
      return { canAdvance: false, reason: 'Issue date is required' };
    }
    if (draft.documentType === 'invoice' && !draft.dueDate) {
      return { canAdvance: false, reason: 'Due date is required for invoices' };
    }
    return { canAdvance: true, reason: '' };
  }
  return { canAdvance: true, reason: '' };
}

export function calcDraftTotals(draft: QuickInvoiceDraft) {
  return recalcInvoice(draft.items, draft.taxRate, draft.discountPct);
}

export function clientFromDraft(draft: QuickInvoiceDraft): Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'> | null {
  if (!draft.newClientName.trim()) return null;
  return {
    name: draft.newClientName.trim(),
    email: draft.newClientEmail.trim() || null,
    phone: draft.newClientPhone.trim() || null,
    address: null,
    company: null,
    notes: null,
    tax_id: null,
  };
}

export function invoiceInsertFromDraft(
  draft: QuickInvoiceDraft,
  profile: BusinessProfile,
  invoiceNumber: string,
): Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'invoice_items' | 'invoice_payments'> {
  const totals = calcDraftTotals(draft);
  const isEstimate = draft.documentType === 'estimate';

  return {
    invoice_number: isEstimate ? invoiceNumber : invoiceNumber,
    estimate_number: isEstimate ? invoiceNumber : null,
    client_id: draft.clientId,
    client_name: draft.newClientName.trim() || null,
    client_email: draft.newClientEmail.trim() || null,
    client_phone: draft.newClientPhone.trim() || null,
    client_address: null,
    work_order_number: null,
    technician_name: null,
    status: 'draft',
    issue_date: draft.issueDate,
    due_date: draft.documentType === 'invoice' ? draft.dueDate : null,
    subtotal: totals.subtotal,
    tax_rate: draft.taxRate,
    tax_amount: totals.taxAmount,
    discount_amount: draft.discountPct,
    fees_amount: 0,
    total: totals.total,
    notes: draft.notes.trim() || null,
    terms: draft.terms.trim() || null,
    warranty: null,
    metadata: {},
    industry_template: profile.industry_template || null,
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
    payment_status: 'unpaid',
    hearth_status: null,
    hearth_application_url: null,
    document_type: draft.documentType,
    parent_invoice_id: null,
    deposit_amount: 0,
    shipping_amount: 0,
    recurring_enabled: false,
    recurring_interval: null,
    recurring_next_date: null,
    converted_at: null,
  };
}

export function itemsForInsert(draft: QuickInvoiceDraft): InvoiceItem[] {
  return draft.items
    .filter(i => i.description.trim() && i.quantity > 0)
    .map((item, i) => ({
      ...item,
      total: round2(item.quantity * item.unit_price),
      sort_order: i,
    }));
}

const AUTOSAVE_KEY = 'swift_invoice_quick_draft';

export function saveDraftToStorage(draft: QuickInvoiceDraft): void {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
  } catch { /* quota or private mode — silently ignore */ }
}

export function loadDraftFromStorage(): QuickInvoiceDraft | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickInvoiceDraft;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraftFromStorage(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch { /* ignore */ }
}

export function hasAutosavedDraft(): boolean {
  try {
    return Boolean(localStorage.getItem(AUTOSAVE_KEY));
  } catch {
    return false;
  }
}
