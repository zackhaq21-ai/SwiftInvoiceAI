import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Check, ChevronRight, ChevronLeft, Plus, Trash2, Mic,
  User, FileText, Eye, Loader2, AlertCircle,
  CheckCircle2, Sparkles, Zap, X, Save,
  Search, Clock, Contact,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useClients, useBusinessProfile, useInvoices } from '@/lib/hooks';
import { hasContactPicker, pickContact } from '@/lib/mobile';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { calcItemTotal, round2 } from '@/lib/calc';
import { suggestFromNotes, type SuggestedItem } from '@/lib/tradeAssistant';
import { parseVoiceInvoice } from '@/lib/voiceParser';
import { canCreateInvoice } from '@/lib/plans';
import {
  type QuickInvoiceDraft, type QuickInvoiceStep,
  emptyDraft, emptyItem, stepFromValidation, calcDraftTotals,
  clientFromDraft, invoiceInsertFromDraft, itemsForInsert,
  saveDraftToStorage, loadDraftFromStorage, clearDraftFromStorage,
  hasAutosavedDraft, STEP_LABELS,
} from '@/lib/quickInvoice';
import type { InvoiceItem, Invoice } from '@/lib/types';
import type { View } from '@/App';

interface SpeechRecognitionResultEvent {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number } & { length: number };
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: SpeechRecognitionResultEvent) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface QuickInvoiceProps {
  onNavigate: (view: View) => void;
  onUpgrade: () => void;
}

export default function QuickInvoice({ onNavigate, onUpgrade }: QuickInvoiceProps) {
  const { user, tier } = useAuth();
  const { clients, create: createClient } = useClients();
  const { profile } = useBusinessProfile();
  const { invoices, create: createInvoice } = useInvoices();

  const [draft, setDraft] = useState<QuickInvoiceDraft>(() =>
    loadDraftFromStorage() || emptyDraft(profile)
  );
  const [step, setStep] = useState<QuickInvoiceStep>(0);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceSuggestions, setVoiceSuggestions] = useState<SuggestedItem[]>([]);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [tradeInput, setTradeInput] = useState('');
  const [tradeSuggestions, setTradeSuggestions] = useState<SuggestedItem[]>([]);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [pickingContact, setPickingContact] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRecognitionRef = useRef<{ stop: () => void } | null>(null);

  const accent = profile?.accent_color || '#111827';
  const symbol = profile?.currency_symbol || '$';
  const totals = useMemo(() => calcDraftTotals(draft), [draft]);
  const invoiceCount = invoices.filter(i => i.document_type === 'invoice').length;
  const canCreate = canCreateInvoice(tier, invoiceCount);

  // Autosave draft to localStorage with debounce
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      saveDraftToStorage(draft);
    }, 500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [draft]);

  const updateDraft = useCallback((updates: Partial<QuickInvoiceDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);

  const updateItem = useCallback((index: number, updates: Partial<InvoiceItem>) => {
    setDraft(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, ...updates, total: calcItemTotal({ ...item, ...updates }) } : item
      ),
    }));
  }, []);

  const addItem = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      items: [...prev.items, { ...emptyItem(profile), sort_order: prev.items.length }],
    }));
  }, [profile]);

  const removeItem = useCallback((index: number) => {
    setDraft(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sort_order: i })),
    }));
  }, []);

  // Voice invoice — parse transcript and suggest items
  const handleVoiceParse = useCallback(() => {
    if (!voiceTranscript.trim()) return;
    const parsed = parseVoiceInvoice(voiceTranscript);
    const industryId = profile?.industry_template || 'general';

    // Get trade-aware suggestions from the transcript
    const tradeSuggestion = suggestFromNotes(voiceTranscript, industryId as Parameters<typeof suggestFromNotes>[1]);
    const suggestions = tradeSuggestion.items.length > 0
      ? tradeSuggestion.items
      : parsed.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          item_type: 'service' as const,
          unit: 'ea',
          confidence: item.unit_price > 0 ? 0.8 : 0.5,
        }));

    setVoiceSuggestions(suggestions);

    // Auto-fill client from voice
    if (parsed.clientName && !draft.clientId && !draft.newClientName) {
      updateDraft({ newClientName: parsed.clientName });
    }
    if (parsed.taxRate !== null) {
      updateDraft({ taxRate: parsed.taxRate });
    }
    if (parsed.notes) {
      updateDraft({ notes: parsed.notes });
    }
  }, [voiceTranscript, profile, draft, updateDraft]);

  // Apply voice suggestions to items
  const applyVoiceSuggestion = useCallback((suggestion: SuggestedItem, index: number) => {
    updateItem(index, {
      description: suggestion.description,
      quantity: suggestion.quantity,
      unit_price: suggestion.unit_price,
      item_type: suggestion.item_type,
      unit: suggestion.unit,
    });
    setVoiceSuggestions(prev => prev.filter((_, i) => i !== index));
  }, [updateItem]);

  // Trade assistant — suggest items from notes
  const handleTradeSuggest = useCallback(() => {
    if (!tradeInput.trim()) return;
    const industryId = profile?.industry_template || 'general';
    const suggestion = suggestFromNotes(tradeInput, industryId as Parameters<typeof suggestFromNotes>[1]);
    setTradeSuggestions(suggestion.items);
  }, [tradeInput, profile]);

  const applyTradeSuggestion = useCallback((suggestion: SuggestedItem) => {
    setDraft(prev => ({
      ...prev,
      items: [...prev.items, {
        ...emptyItem(profile),
        description: suggestion.description,
        quantity: suggestion.quantity,
        unit_price: suggestion.unit_price,
        item_type: suggestion.item_type,
        unit: suggestion.unit,
        total: round2(suggestion.quantity * suggestion.unit_price),
        sort_order: prev.items.length,
      }],
    }));
    setTradeSuggestions(prev => prev.filter(s => s.description !== suggestion.description));
  }, [profile]);

  // Voice recognition using Web Speech API
  const toggleVoiceListening = useCallback(() => {
    if (voiceListening) {
      voiceRecognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }

    const SpeechRecognition = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance; webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceTranscript(transcript);
    };

    recognition.onerror = () => {
      setVoiceListening(false);
      setError('Voice recognition error. Please try again.');
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognition.start();
    voiceRecognitionRef.current = recognition;
    setVoiceListening(true);
    setShowVoicePanel(true);
    setError(null);
  }, [voiceListening]);

  // Step navigation
  const validation = stepFromValidation(step, draft);

  const canAdvance = validation.canAdvance;
  const canGoBack = step > 0 && !creating;

  const goNext = useCallback(() => {
    if (!canAdvance) return;
    setError(null);
    setStep(prev => Math.min(4, prev + 1) as QuickInvoiceStep);
  }, [canAdvance]);

  const goBack = useCallback(() => {
    if (step === 0) return;
    setError(null);
    setStep(prev => Math.max(0, prev - 1) as QuickInvoiceStep);
  }, [step]);

  const handleCreate = useCallback(async () => {
    if (!user || !profile || creating) return;
    if (!canCreate) {
      onUpgrade();
      return;
    }

    setCreating(true);
    setError(null);
    try {
      // Create new client if needed
      let clientId = draft.clientId;
      const newClientData = clientFromDraft(draft);
      if (!clientId && newClientData) {
        const newClient = await createClient(newClientData as Parameters<typeof createClient>[0]);
        if (newClient) clientId = newClient.id;
      }

      const invoiceNumber = `${profile.invoice_prefix}-${String(profile.next_invoice_number).padStart(4, '0')}`;
      const invoiceData = invoiceInsertFromDraft(draft, profile, invoiceNumber);
      if (clientId) invoiceData.client_id = clientId;

      const items = itemsForInsert(draft);
      const created = await createInvoice(invoiceData as Parameters<typeof createInvoice>[0], items);
      if (!created) {
        setError('Failed to create. Please try again.');
        setCreating(false);
        return;
      }

      // Increment invoice number
      await supabase
        .from('business_profile')
        .update({ next_invoice_number: profile.next_invoice_number + 1 })
        .eq('id', profile.id);

      clearDraftFromStorage();
      setCreatedInvoice(created);
      setStep(4);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
    } finally {
      setCreating(false);
    }
  }, [user, profile, creating, canCreate, draft, createClient, createInvoice, onUpgrade]);

  const handleStartNew = useCallback(() => {
    setDraft(emptyDraft(profile));
    setStep(0);
    setCreatedInvoice(null);
    setError(null);
    setVoiceTranscript('');
    setVoiceSuggestions([]);
    setTradeInput('');
    setTradeSuggestions([]);
    clearDraftFromStorage();
  }, [profile]);

  const handleDiscardAutosave = useCallback(() => {
    clearDraftFromStorage();
    setDraft(emptyDraft(profile));
    setStep(0);
  }, [profile]);

  const handlePickContact = useCallback(async () => {
    setPickingContact(true);
    try {
      const picked = await pickContact();
      if (!picked) return;
      updateDraft({
        clientId: null,
        newClientName: picked.name,
        newClientEmail: picked.email || '',
        newClientPhone: picked.phone || '',
      });
    } finally {
      setPickingContact(false);
    }
  }, [updateDraft]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients.slice(0, 20);
    return clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    ).slice(0, 20);
  }, [clients, search]);

  // ── SUCCESS STATE ──
  if (createdInvoice && step === 4) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 max-w-2xl mx-auto animate-fade-in">
        <div className="card p-8 sm:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: `${accent}15` }}>
            <CheckCircle2 className="w-8 h-8" style={{ color: accent }} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {draft.documentType === 'invoice' ? 'Invoice created!' : 'Estimate created!'}
          </h2>
          <p className="text-slate-500 mb-1">
            {createdInvoice.invoice_number} — {formatCurrency(createdInvoice.total, symbol)}
          </p>
          <p className="text-sm text-slate-400 mb-6">
            for {createdInvoice.client_name || 'Client'}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => onNavigate({ name: 'preview', invoiceId: createdInvoice.id })}
              className="btn-primary"
              style={{ background: accent }}
            >
              <Eye className="w-4 h-4" />
              Preview & Send
            </button>
            <button
              onClick={() => onNavigate({ name: 'editor', invoiceId: createdInvoice.id })}
              className="btn-secondary"
            >
              <FileText className="w-4 h-4" />
              Open in Editor
            </button>
            <button
              onClick={handleStartNew}
              className="btn-secondary"
            >
              <Plus className="w-4 h-4" />
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: accent }} />
            Quick Invoice
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 hidden sm:block">Create and send in under a minute</p>
        </div>
        <button
          onClick={() => onNavigate({ name: 'editor' })}
          className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Full editor</span>
        </button>
      </div>

      {/* Step progress */}
      <div className="flex items-center mb-8 overflow-x-auto scrollbar-thin">
        {STEP_LABELS.map((label, i) => {
          const isActive = i === step;
          const isComplete = i < step;
          return (
            <div key={label} className="flex items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isComplete ? 'text-white' : isActive ? 'text-white' : 'text-slate-400 bg-slate-100'
                  }`}
                  style={isComplete || isActive ? { background: accent } : undefined}
                >
                  {isComplete ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-xs font-medium ${isActive ? 'text-slate-900' : isComplete ? 'text-slate-600' : 'text-slate-400'} hidden sm:inline`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`w-6 sm:w-10 h-0.5 mx-1 sm:mx-2 ${isComplete ? '' : 'bg-slate-200'}`} style={isComplete ? { background: accent } : undefined} />
              )}
            </div>
          );
        })}
      </div>

      {/* Autosave notice */}
      {hasAutosavedDraft() && step === 0 && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Save className="w-4 h-4 flex-shrink-0" />
            <span>Restored your draft from last time.</span>
          </div>
          <button onClick={handleDiscardAutosave} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <X className="w-3 h-3" /> Discard
          </button>
        </div>
      )}

      {/* ── STEP 0: CLIENT ── */}
      {step === 0 && (
        <div className="space-y-4 animate-fade-in">
          {/* Search existing clients */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search existing clients…"
              className="input pl-10"
            />
          </div>

          {filteredClients.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {filteredClients.map(client => (
                <button
                  key={client.id}
                  onClick={() => {
                    updateDraft({
                      clientId: client.id,
                      newClientName: '',
                      newClientEmail: '',
                      newClientPhone: '',
                    });
                    setStep(1);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left min-h-[44px] ${
                    draft.clientId === client.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{client.name}</p>
                    {client.email && <p className="text-xs text-slate-500 truncate">{client.email}</p>}
                  </div>
                  {draft.clientId === client.id && <Check className="w-4 h-4 text-slate-900 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {hasContactPicker() && (
            <button
              type="button"
              onClick={handlePickContact}
              disabled={pickingContact}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.99] transition-all min-touch disabled:opacity-60"
            >
              {pickingContact
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Contact className="w-4 h-4" />}
              {pickingContact ? 'Opening contacts…' : 'Import from contacts'}
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or add new</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* New client form */}
          <div className="space-y-3">
            <div>
              <label className="label">Client name *</label>
              <input
                type="text"
                value={draft.newClientName}
                onChange={e => updateDraft({ newClientName: e.target.value, clientId: null })}
                placeholder="e.g. John Smith"
                className="input"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={draft.newClientEmail}
                  onChange={e => updateDraft({ newClientEmail: e.target.value })}
                  placeholder="john@example.com"
                  className="input"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  value={draft.newClientPhone}
                  onChange={e => updateDraft({ newClientPhone: e.target.value })}
                  placeholder="555-1234"
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 1: ITEMS ── */}
      {step === 1 && (
        <div className="space-y-4 animate-fade-in">
          {/* Voice + Trade assistant toggle */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleVoiceListening}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all min-h-[44px] ${
                voiceListening
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              <Mic className={`w-4 h-4 ${voiceListening ? 'animate-pulse' : ''}`} />
              {voiceListening ? 'Stop listening' : 'Voice input'}
            </button>
            <button
              onClick={() => setShowVoicePanel(!showVoicePanel)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 transition-all min-h-[44px]"
            >
              <Sparkles className="w-4 h-4" />
              AI paste
            </button>
          </div>

          {/* Voice panel */}
          {(voiceListening || showVoicePanel) && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3 animate-fade-in">
              <textarea
                value={voiceTranscript}
                onChange={e => setVoiceTranscript(e.target.value)}
                placeholder="Speak or paste your invoice details… e.g. 'Fix AC unit for John Smith, 2 hours labor at $95, capacitor replacement $180, tax 8%'"
                className="input min-h-[80px] resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleVoiceParse}
                  disabled={!voiceTranscript.trim()}
                  className="btn-primary text-sm py-2 disabled:opacity-40"
                  style={{ background: accent }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Parse with AI
                </button>
                {voiceSuggestions.length > 0 && (
                  <button
                    onClick={() => {
                      voiceSuggestions.forEach(s => applyTradeSuggestion(s));
                      setVoiceSuggestions([]);
                    }}
                    className="btn-secondary text-sm py-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add all ({voiceSuggestions.length})
                  </button>
                )}
              </div>
              {voiceSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-indigo-700">AI suggestions — tap to fill:</p>
                  {voiceSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => applyVoiceSuggestion(s, i)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg bg-white border border-indigo-100 hover:border-indigo-300 transition-all text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{s.description}</p>
                        <p className="text-xs text-slate-500">
                          {s.quantity} {s.unit} × {formatCurrency(s.unit_price, symbol)}
                          {s.confidence < 0.8 && <span className="text-amber-600 ml-1">— verify price</span>}
                        </p>
                      </div>
                      <Zap className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Trade assistant */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={tradeInput}
                onChange={e => setTradeInput(e.target.value)}
                placeholder="Describe work… e.g. 'replaced furnace blower motor and cleaned coils'"
                className="input flex-1 text-sm"
              />
              <button
                onClick={handleTradeSuggest}
                disabled={!tradeInput.trim()}
                className="btn-secondary text-sm py-2 disabled:opacity-40 min-h-[44px]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Suggest
              </button>
            </div>
            {tradeSuggestions.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {tradeSuggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => applyTradeSuggestion(s)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-all text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900">{s.description}</span>
                      <span className="text-xs text-slate-500 ml-2">
                        {s.quantity} {s.unit} × {formatCurrency(s.unit_price, symbol)}
                      </span>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="space-y-3">
            {draft.items.map((item, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(i, { description: e.target.value })}
                    placeholder="Description"
                    className="input flex-1 text-sm"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium uppercase">Qty</label>
                    <input
                      type="number"
                      value={item.quantity || ''}
                      onChange={e => updateItem(i, { quantity: parseFloat(e.target.value) || 0 })}
                      className="input text-sm py-2"
                      min="0"
                      step="any"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium uppercase">Price</label>
                    <input
                      type="number"
                      value={item.unit_price || ''}
                      onChange={e => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                      className="input text-sm py-2"
                      min="0"
                      step="any"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium uppercase">Total</label>
                    <div className="input text-sm py-2 bg-slate-50 flex items-center font-semibold text-slate-700">
                      {formatCurrency(item.total, symbol)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={addItem}
              className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all text-sm font-medium min-h-[44px]"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Add item
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: DETAILS ── */}
      {step === 2 && (
        <div className="space-y-4 animate-fade-in">
          {/* Document type toggle */}
          <div>
            <label className="label">Document type</label>
            <div className="flex gap-2">
              <button
                onClick={() => updateDraft({ documentType: 'invoice' })}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                  draft.documentType === 'invoice'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1" />
                Invoice
              </button>
              <button
                onClick={() => updateDraft({ documentType: 'estimate' })}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all min-h-[44px] ${
                  draft.documentType === 'estimate'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                <Clock className="w-4 h-4 inline mr-1" />
                Estimate
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Issue date *</label>
              <input
                type="date"
                value={draft.issueDate}
                onChange={e => updateDraft({ issueDate: e.target.value })}
                className="input"
              />
            </div>
            {draft.documentType === 'invoice' && (
              <div>
                <label className="label">Due date *</label>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={e => updateDraft({ dueDate: e.target.value })}
                  className="input"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tax rate (%)</label>
              <input
                type="number"
                value={draft.taxRate || ''}
                onChange={e => updateDraft({ taxRate: parseFloat(e.target.value) || 0 })}
                className="input"
                min="0"
                step="any"
              />
            </div>
            <div>
              <label className="label">Discount (%)</label>
              <input
                type="number"
                value={draft.discountPct || ''}
                onChange={e => updateDraft({ discountPct: parseFloat(e.target.value) || 0 })}
                className="input"
                min="0"
                step="any"
              />
            </div>
          </div>

          <div>
            <label className="label">Notes (internal)</label>
            <textarea
              value={draft.notes}
              onChange={e => updateDraft({ notes: e.target.value })}
              placeholder="Internal notes, not shown to client"
              className="input min-h-[60px] resize-y"
            />
          </div>
          <div>
            <label className="label">Terms</label>
            <textarea
              value={draft.terms}
              onChange={e => updateDraft({ terms: e.target.value })}
              placeholder="Payment terms, warranty, etc."
              className="input min-h-[60px] resize-y"
            />
          </div>
        </div>
      )}

      {/* ── STEP 3: REVIEW ── */}
      {step === 3 && (
        <div className="space-y-4 animate-fade-in">
          <div className="card p-5 space-y-4">
            {/* Client info */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Client</p>
              <p className="font-medium text-slate-900">
                {draft.clientId
                  ? clients.find(c => c.id === draft.clientId)?.name || 'Selected client'
                  : draft.newClientName || '—'}
              </p>
              {(draft.newClientEmail || clients.find(c => c.id === draft.clientId)?.email) && (
                <p className="text-sm text-slate-500">
                  {draft.newClientEmail || clients.find(c => c.id === draft.clientId)?.email}
                </p>
              )}
            </div>

            {/* Items summary */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Items</p>
              <div className="space-y-1.5">
                {draft.items.filter(i => i.description.trim()).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-700 truncate flex-1 pr-2">
                      {item.quantity} × {item.description}
                    </span>
                    <span className="font-medium text-slate-900 flex-shrink-0">
                      {formatCurrency(item.total, symbol)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-700">{formatCurrency(totals.subtotal, symbol)}</span>
              </div>
              {draft.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax ({draft.taxRate}%)</span>
                  <span className="text-slate-700">{formatCurrency(totals.taxAmount, symbol)}</span>
                </div>
              )}
              {draft.discountPct > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount ({draft.discountPct}%)</span>
                  <span className="text-slate-700">−{formatCurrency(totals.discountAmount, symbol)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1.5">
                <span className="text-slate-900">Total</span>
                <span style={{ color: accent }}>{formatCurrency(totals.total, symbol)}</span>
              </div>
            </div>

            {/* Dates */}
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-slate-400">Issue: </span>
                <span className="text-slate-700">{draft.issueDate}</span>
              </div>
              {draft.documentType === 'invoice' && (
                <div>
                  <span className="text-slate-400">Due: </span>
                  <span className="text-slate-700">{draft.dueDate}</span>
                </div>
              )}
            </div>

            {/* Plan limit warning */}
            {!canCreate && draft.documentType === 'invoice' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>You've reached your plan's invoice limit. Upgrade to create more.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 gap-3">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {step < 3 ? (
          <button
            onClick={goNext}
            disabled={!canAdvance}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            style={{ background: accent }}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : step === 3 ? (
          <button
            onClick={handleCreate}
            disabled={creating || (!canCreate && draft.documentType === 'invoice')}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            style={{ background: accent }}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Create {draft.documentType === 'invoice' ? 'invoice' : 'estimate'}</>}
          </button>
        ) : null}
      </div>
    </div>
  );
}
