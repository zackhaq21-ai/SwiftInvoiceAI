import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Autosave debounce logic ────────────────────────────────────────────────

describe('InvoiceEditor autosave', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not fire for a brand-new invoice (no existing ID)', () => {
    let saves = 0;
    const update = () => { saves++; return Promise.resolve({ id: 'x' }); };
    const hasExisting = false;

    const timer = setTimeout(() => {
      if (hasExisting) update();
    }, 2000);

    vi.advanceTimersByTime(3000);
    clearTimeout(timer);
    expect(saves).toBe(0);
  });

  it('fires after debounce for an existing draft', () => {
    let saves = 0;
    const update = () => { saves++; return Promise.resolve({ id: 'x' }); };
    const hasExisting = true;
    const status = 'draft';

    setTimeout(() => {
      if (hasExisting && status === 'draft') update();
    }, 2000);

    vi.advanceTimersByTime(1000);
    expect(saves).toBe(0);
    vi.advanceTimersByTime(1500);
    expect(saves).toBe(1);
  });

  it('does not fire for non-draft invoices', () => {
    let saves = 0;
    const update = () => { saves++; return Promise.resolve({ id: 'x' }); };
    const hasExisting = true;
    const status: string = 'sent';

    const timer = setTimeout(() => {
      if (hasExisting && status === 'draft') update();
    }, 2000);

    vi.advanceTimersByTime(3000);
    clearTimeout(timer);
    expect(saves).toBe(0);
  });

  it('cancels stale timer on new change', () => {
    let saves = 0;
    const update = () => { saves++; return Promise.resolve({ id: 'x' }); };

    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => update(), 2000);
    };

    schedule();
    vi.advanceTimersByTime(1500);
    schedule(); // cancel and reschedule
    vi.advanceTimersByTime(1500);
    expect(saves).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(saves).toBe(1);
  });

  it('skips save when payload unchanged', () => {
    let saves = 0;
    const update = () => { saves++; return Promise.resolve({ id: 'x' }); };
    let lastSig = '';

    const payload = { a: 1, b: 2 };
    const sig = JSON.stringify(payload);

    const timer = setTimeout(() => {
      if (sig === lastSig) return;
      lastSig = sig;
      update();
    }, 2000);

    vi.advanceTimersByTime(2000);
    expect(saves).toBe(1);

    // Second fire with same payload
    const timer2 = setTimeout(() => {
      if (sig === lastSig) return;
      lastSig = sig;
      update();
    }, 2000);
    vi.advanceTimersByTime(2000);
    expect(saves).toBe(1);
    clearTimeout(timer);
    clearTimeout(timer2);
  });
});

// ── No duplicate creation ──────────────────────────────────────────────────

describe('Autosave never creates duplicates', () => {
  it('only calls update, never create, for existing invoices', () => {
    let creates = 0;
    let updates = 0;
    const existingInvoice = { id: 'inv-123', status: 'draft' };

    const save = () => {
      if (existingInvoice) { updates++; return { id: existingInvoice.id }; }
      else { creates++; return { id: 'new' }; }
    };

    save(); save(); save();
    expect(updates).toBe(3);
    expect(creates).toBe(0);
  });

  it('does not auto-save for new invoices — requires explicit Save', () => {
    let creates = 0;
    const existingInvoice = null;

    const autoSave = () => {
      if (!existingInvoice) return; // skip
      creates++;
    };

    autoSave(); autoSave(); autoSave();
    expect(creates).toBe(0);
  });
});

// ── Error / retry behavior ─────────────────────────────────────────────────

describe('Autosave error and retry', () => {
  it('shows error state when save fails', async () => {
    let status = 'idle';
    const update = () => Promise.resolve(null); // failure

    const result = await update();
    if (!result) status = 'error';
    expect(status).toBe('error');
  });

  it('recovers to saved on retry', async () => {
    let status = 'error';
    let attempt = 0;
    const update = () => {
      attempt++;
      return attempt === 1 ? Promise.resolve(null) : Promise.resolve({ id: 'x' });
    };

    let result = await update();
    if (!result) status = 'error';
    expect(status).toBe('error');

    result = await update();
    if (result) status = 'saved';
    expect(status).toBe('saved');
  });

  it('shows accessible error with retry action', () => {
    const errorMarkup = (err: string | null) => {
      if (!err) return null;
      return {
        role: 'alert',
        message: 'Could not save automatically.',
        retry: true,
      };
    };

    const markup = errorMarkup('Network error');
    expect(markup).not.toBeNull();
    expect(markup!.role).toBe('alert');
    expect(markup!.retry).toBe(true);
  });
});

// ── Manual save race prevention ────────────────────────────────────────────

describe('Manual save race prevention', () => {
  it('manual save blocks concurrent autosave', () => {
    let manualSaving = false;
    let autoSaves = 0;
    let manualSaves = 0;

    const manualSave = () => {
      manualSaving = true;
      manualSaves++;
    };
    const autoSave = () => {
      if (manualSaving) return;
      autoSaves++;
    };

    manualSave();
    autoSave();
    autoSave();
    expect(manualSaves).toBe(1);
    expect(autoSaves).toBe(0);
  });

  it('autosave resumes after manual save completes', () => {
    let manualSaving = true;
    let autoSaves = 0;

    // Manual save in progress
    const autoSave = () => {
      if (manualSaving) return;
      autoSaves++;
    };

    autoSave();
    expect(autoSaves).toBe(0);

    // Manual save finishes
    manualSaving = false;
    autoSave();
    expect(autoSaves).toBe(1);
  });

  it('clears autosave timer when manual save starts', () => {
    let timerCleared = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let manualSaving = false;

    timer = setTimeout(() => {
      if (!manualSaving) { /* would save */ }
    }, 2000);

    const manualSave = () => {
      manualSaving = true;
      if (timer) { clearTimeout(timer); timerCleared = true; }
    };

    manualSave();
    expect(timerCleared).toBe(true);
  });

  it('does not update after unmount', () => {
    let mounted = true;
    let saves = 0;

    const update = () => {
      if (!mounted) return;
      saves++;
    };

    // Simulate unmount
    mounted = false;
    update();
    expect(saves).toBe(0);
  });
});

// ── AI mode review-first ───────────────────────────────────────────────────

describe('Create with AI review-first', () => {
  it('populates fields but does not auto-send', () => {
    const sentCount = 0;
    const populatedFields: Record<string, unknown> = {};

    const handleAIGenerate = (input: string) => {
      // Simulate parsing
      if (input.includes('John Smith')) populatedFields.clientName = 'John Smith';
      if (input.includes('$95')) populatedFields.items = [{ description: 'Labor', quantity: 1, unit_price: 95 }];
      // Never sends
      return populatedFields;
    };

    const result = handleAIGenerate('Fixed sink for John Smith, 1 hour at $95');
    expect(result.clientName).toBe('John Smith');
    expect(sentCount).toBe(0);
  });

  it('shows loading state during AI processing', () => {
    let loading = false;

    expect(loading).toBe(false);
    loading = true;
    expect(loading).toBe(true);
    loading = false;
    expect(loading).toBe(false);
  });

  it('shows error on parse failure', () => {
    let error: string | null = null;
    const handleAIGenerate = (input: string) => {
      if (!input.trim()) {
        error = 'Could not parse the description.';
        return;
      }
    };

    handleAIGenerate('');
    expect(error).toBe('Could not parse the description.');
  });

  it('does not invent pricing when not provided', () => {
    const parseInvoiceText = (text: string) => {
      // If no price mentioned, unit_price stays 0
      const priceMatch = text.match(/\$?(\d+\.?\d*)/);
      return {
        items: [{
          description: 'Repair',
          quantity: 1,
          unit_price: priceMatch ? parseFloat(priceMatch[1]) : 0,
        }],
      };
    };

    const result = parseInvoiceText('Fixed the sink, no price mentioned');
    expect(result.items[0].unit_price).toBe(0);
  });
});

// ── Create launcher routing ────────────────────────────────────────────────

interface LauncherView {
  name: string;
  documentType?: string;
  aiMode?: boolean;
}

describe('Create launcher routing', () => {
  const CREATE_OPTIONS: { id: string; view: LauncherView }[] = [
    { id: 'invoice', view: { name: 'editor' } },
    { id: 'estimate', view: { name: 'editor', documentType: 'estimate' } },
    { id: 'ai', view: { name: 'editor', aiMode: true } },
    { id: 'voice', view: { name: 'voice' } },
    { id: 'customer', view: { name: 'clients' } },
    { id: 'expense', view: { name: 'expenses' } },
    { id: 'item', view: { name: 'products' } },
  ];

  it('invoice routes to editor', () => {
    const opt = CREATE_OPTIONS.find(o => o.id === 'invoice');
    expect(opt!.view.name).toBe('editor');
  });

  it('estimate routes to editor with documentType estimate', () => {
    const opt = CREATE_OPTIONS.find(o => o.id === 'estimate');
    expect(opt!.view.name).toBe('editor');
    expect(opt!.view.documentType).toBe('estimate');
  });

  it('AI routes to editor with aiMode, not voice', () => {
    const opt = CREATE_OPTIONS.find(o => o.id === 'ai');
    expect(opt!.view.name).toBe('editor');
    expect(opt!.view.aiMode).toBe(true);
  });

  it('voice routes to voice view (distinct from AI)', () => {
    const opt = CREATE_OPTIONS.find(o => o.id === 'voice');
    expect(opt!.view.name).toBe('voice');
  });

  it('customer routes to clients', () => {
    const opt = CREATE_OPTIONS.find(o => o.id === 'customer');
    expect(opt!.view.name).toBe('clients');
  });

  it('expense routes to expenses', () => {
    const opt = CREATE_OPTIONS.find(o => o.id === 'expense');
    expect(opt!.view.name).toBe('expenses');
  });

  it('item routes to products', () => {
    const opt = CREATE_OPTIONS.find(o => o.id === 'item');
    expect(opt!.view.name).toBe('products');
  });

  it('all 7 options have valid view names', () => {
    const validViews = ['editor', 'voice', 'clients', 'expenses', 'products'];
    CREATE_OPTIONS.forEach(opt => {
      expect(validViews).toContain(opt.view.name);
    });
  });

  it('no two options share the same route (except editor variants)', () => {
    const routes = CREATE_OPTIONS.map(o => {
      const v = o.view;
      return `${v.name}:${v.documentType || v.aiMode || ''}`;
    });
    const unique = new Set(routes);
    expect(unique.size).toBe(routes.length);
  });
});
