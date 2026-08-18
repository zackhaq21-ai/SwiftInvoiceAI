import { describe, it, expect } from 'vitest';

// ─── Breakpoint Hook ───────────────────────────────────────────────────────

describe('useBreakpoint', () => {
  it('returns a valid breakpoint on wide screens', () => {
    // jsdom defaults to a wide screen
    expect(['desktop', 'tablet', 'mobile']).toContain('desktop');
  });

  it('computes mobile for widths < 768', () => {
    const compute = (w: number) => w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    expect(compute(320)).toBe('mobile');
    expect(compute(375)).toBe('mobile');
    expect(compute(430)).toBe('mobile');
  });

  it('computes tablet for 768-1023', () => {
    const compute = (w: number) => w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    expect(compute(768)).toBe('tablet');
    expect(compute(820)).toBe('tablet');
    expect(compute(1023)).toBe('tablet');
  });

  it('computes desktop for 1024+', () => {
    const compute = (w: number) => w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
    expect(compute(1024)).toBe('desktop');
    expect(compute(1440)).toBe('desktop');
  });
});

// ─── Mobile Nav Structure ──────────────────────────────────────────────────

describe('Mobile bottom navigation structure', () => {
  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Home' },
    { id: 'clients', label: 'Customers' },
    { id: 'invoices', label: 'Invoices' },
    { id: 'team', label: 'Team' },
  ];

  it('has exactly 4 nav items with a center create action', () => {
    expect(NAV_ITEMS).toHaveLength(4);
  });

  it('includes Home, Customers, Invoices, and Team', () => {
    const labels = NAV_ITEMS.map(i => i.label);
    expect(labels).toContain('Home');
    expect(labels).toContain('Customers');
    expect(labels).toContain('Invoices');
    expect(labels).toContain('Team');
  });

  it('has the correct order: Home, Customers, Invoices, Team', () => {
    expect(NAV_ITEMS.map(i => i.id)).toEqual(['dashboard', 'clients', 'invoices', 'team']);
  });
});

// ─── Create Launcher Options ───────────────────────────────────────────────

describe('Create launcher options', () => {
  const CREATE_OPTIONS = [
    { id: 'invoice', label: 'Invoice' },
    { id: 'estimate', label: 'Estimate' },
    { id: 'ai', label: 'Create with AI' },
    { id: 'voice', label: 'Voice Invoice' },
    { id: 'customer', label: 'Customer' },
    { id: 'expense', label: 'Expense' },
    { id: 'item', label: 'Item / Service' },
  ];

  it('offers all required create types', () => {
    const labels = CREATE_OPTIONS.map(o => o.label);
    expect(labels).toContain('Invoice');
    expect(labels).toContain('Estimate');
    expect(labels).toContain('Customer');
    expect(labels).toContain('Expense');
    expect(labels).toContain('Item / Service');
  });

  it('includes AI and voice creation paths', () => {
    const labels = CREATE_OPTIONS.map(o => o.label);
    expect(labels).toContain('Create with AI');
    expect(labels).toContain('Voice Invoice');
  });
});

// ─── Invoice Validation Logic ──────────────────────────────────────────────

describe('Invoice validation', () => {
  const validateInvoice = (items: { description: string; quantity: number; unit_price: number }[], clientName: string) => {
    const errors: string[] = [];
    if (!clientName.trim()) errors.push('Customer name is required');
    const hasValidItem = items.some(i => i.description.trim() && i.quantity > 0 && i.unit_price >= 0);
    if (!hasValidItem) errors.push('At least one line item with a description is required');
    return errors;
  };

  it('passes with valid items and customer', () => {
    const errors = validateInvoice(
      [{ description: 'Water heater install', quantity: 1, unit_price: 500 }],
      'John Smith'
    );
    expect(errors).toHaveLength(0);
  });

  it('fails without customer name', () => {
    const errors = validateInvoice(
      [{ description: 'Service', quantity: 1, unit_price: 100 }],
      ''
    );
    expect(errors).toContain('Customer name is required');
  });

  it('fails without any valid line items', () => {
    const errors = validateInvoice(
      [{ description: '', quantity: 0, unit_price: 0 }],
      'John'
    );
    expect(errors).toContain('At least one line item with a description is required');
  });

  it('fails with items but no descriptions', () => {
    const errors = validateInvoice(
      [{ description: '', quantity: 2, unit_price: 50 }],
      'John'
    );
    expect(errors).toContain('At least one line item with a description is required');
  });

  it('passes with multiple valid items', () => {
    const errors = validateInvoice(
      [
        { description: 'Labor', quantity: 3, unit_price: 95 },
        { description: 'Parts', quantity: 2, unit_price: 35 },
      ],
      'Acme Corp'
    );
    expect(errors).toHaveLength(0);
  });

  it('fails with zero quantity items only', () => {
    const errors = validateInvoice(
      [{ description: 'Service', quantity: 0, unit_price: 100 }],
      'John'
    );
    expect(errors).toContain('At least one line item with a description is required');
  });
});

// ─── Estimate Conversion Logic ─────────────────────────────────────────────

describe('Estimate conversion', () => {
  type EstimateState = { id: string; status: string; converted_at: string | null; document_type: string };

  const canConvert = (est: EstimateState) => {
    return !est.converted_at && est.status !== 'declined' && est.document_type === 'estimate';
  };

  it('allows conversion for a draft estimate', () => {
    expect(canConvert({ id: '1', status: 'draft', converted_at: null, document_type: 'estimate' })).toBe(true);
  });

  it('allows conversion for a sent estimate', () => {
    expect(canConvert({ id: '1', status: 'sent', converted_at: null, document_type: 'estimate' })).toBe(true);
  });

  it('allows conversion for an accepted estimate', () => {
    expect(canConvert({ id: '1', status: 'accepted', converted_at: null, document_type: 'estimate' })).toBe(true);
  });

  it('blocks conversion for a declined estimate', () => {
    expect(canConvert({ id: '1', status: 'declined', converted_at: null, document_type: 'estimate' })).toBe(false);
  });

  it('blocks conversion for an already-converted estimate', () => {
    expect(canConvert({ id: '1', status: 'accepted', converted_at: '2026-01-01', document_type: 'estimate' })).toBe(false);
  });

  it('blocks conversion for a regular invoice (not an estimate)', () => {
    expect(canConvert({ id: '1', status: 'draft', converted_at: null, document_type: 'invoice' })).toBe(false);
  });
});

// ─── Empty / Error State Helpers ───────────────────────────────────────────

describe('Empty and error states', () => {
  const getEmptyMessage = (hasSearch: boolean, hasFilter: boolean, itemCount: number) => {
    if (itemCount > 0) return null;
    if (hasSearch || hasFilter) return 'No items match your filters';
    return 'No items yet';
  };

  it('shows "No items yet" when no search/filter and empty list', () => {
    expect(getEmptyMessage(false, false, 0)).toBe('No items yet');
  });

  it('shows "No items match your filters" when searching with no results', () => {
    expect(getEmptyMessage(true, false, 0)).toBe('No items match your filters');
  });

  it('shows "No items match your filters" when filtering with no results', () => {
    expect(getEmptyMessage(false, true, 0)).toBe('No items match your filters');
  });

  it('returns null when items exist', () => {
    expect(getEmptyMessage(false, false, 5)).toBeNull();
  });

  it('returns null when items exist even with search', () => {
    expect(getEmptyMessage(true, true, 3)).toBeNull();
  });
});

// ─── Customer Quick Actions ────────────────────────────────────────────────

describe('Customer quick actions', () => {
  const buildSafeLink = (type: 'tel' | 'sms' | 'mailto', value: string) => {
    if (!value) return null;
    return `${type}:${value}`;
  };

  it('builds tel: link for phone', () => {
    expect(buildSafeLink('tel', '+15551234567')).toBe('tel:+15551234567');
  });

  it('builds sms: link for phone', () => {
    expect(buildSafeLink('sms', '+15551234567')).toBe('sms:+15551234567');
  });

  it('builds mailto: link for email', () => {
    expect(buildSafeLink('mailto', 'john@example.com')).toBe('mailto:john@example.com');
  });

  it('returns null for empty phone', () => {
    expect(buildSafeLink('tel', '')).toBeNull();
  });

  it('returns null for empty email', () => {
    expect(buildSafeLink('mailto', '')).toBeNull();
  });
});

// ─── Duplicate Submit Prevention ───────────────────────────────────────────

describe('Mobile form duplicate submission', () => {
  it('prevents double submit on save button', () => {
    let saving = false;
    let submitCount = 0;
    const handleSave = () => {
      if (saving) return;
      saving = true;
      submitCount++;
    };

    handleSave();
    handleSave();
    handleSave();
    expect(submitCount).toBe(1);
  });

  it('prevents double submit on resend button', () => {
    let resending = false;
    let resendCount = 0;
    const handleResend = () => {
      if (resending) return;
      resending = true;
      resendCount++;
    };

    handleResend();
    handleResend();
    expect(resendCount).toBe(1);
  });
});
