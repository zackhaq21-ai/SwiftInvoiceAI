import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, Eye,
  Calendar, User, Percent, DollarSign, Mic, Square,
  Sparkles, Wand2, ChevronDown, ChevronUp, Phone, Wrench, Shield, Loader2,
  Package, ChevronRight, Info, AlertCircle, X, Check,
} from 'lucide-react';
import { useInvoices, useClients, useBusinessProfile, useProducts } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { canCreateInvoice } from '@/lib/plans';
import { formatCurrency, todayISO, addDays } from '@/lib/format';
import { calcItemTotal, recalcInvoice } from '@/lib/calc';
import { generateInvoiceNumber } from '@/lib/voiceParser';
import { parseInvoiceText } from '@/lib/invoiceParser';
import { supabase } from '@/lib/supabase';
import { getSpeechRecognition, type SpeechRecognitionLike } from '@/lib/speech';
import {
  INDUSTRY_LIST, getIndustryTemplate, detectIndustryFromItems,
  extractIndustryFields, type IndustryId,
} from '@/lib/industryTemplates';
import {
  suggestFromNotes, defaultItemPresetFor, extractFieldsFromText,
  type SuggestedItem,
} from '@/lib/tradeAssistant';
import UpgradeModal from '@/views/UpgradeModal';
import type { InvoiceItem, InvoiceStatus, ItemType, Product, DocumentType, RecurringInterval } from '@/lib/types';
import type { View } from '@/App';

const TYPE_META: Record<ItemType, { label: string; color: string; bg: string }> = {
  product: { label: 'Product', color: 'text-blue-700', bg: 'bg-blue-50' },
  service: { label: 'Service', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  labor: { label: 'Labor', color: 'text-amber-700', bg: 'bg-amber-50' },
  other: { label: 'Other', color: 'text-slate-600', bg: 'bg-slate-100' },
};

interface InvoiceEditorProps {
  invoiceId?: string;
  documentType?: 'invoice' | 'estimate';
  aiMode?: boolean;
  onNavigate: (view: View) => void;
}

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'labor', label: 'Labor' },
  { value: 'other', label: 'Other' },
];

const UNITS = ['ea', 'hr', 'day', 'sq ft', 'ft', 'lb', 'box', 'lot', 'set', 'kg', 'm', 'person', 'case', 'tray'];

function blankItem(sortOrder: number): InvoiceItem {
  return {
    description: '', quantity: 1, unit_price: 0, total: 0, sort_order: sortOrder,
    item_type: 'service', unit: 'ea', tax_rate: null, discount_amount: 0, notes: null,
  };
}

export default function InvoiceEditor({ invoiceId, documentType: initialDocType, aiMode, onNavigate }: InvoiceEditorProps) {
  const { invoices, create, update } = useInvoices();
  const { clients } = useClients();
  const { profile } = useBusinessProfile();
  const { products } = useProducts();
  const { tier } = useAuth();
  const symbol = profile?.currency_symbol || '$';

  const [loading, setLoading] = useState(!!invoiceId);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedItem[] | null>(null);
  const [suggestNotice, setSuggestNotice] = useState<string | null>(null);
  const [autoDetectNotice, setAutoDetectNotice] = useState<string | null>(null);

  const [items, setItems] = useState<InvoiceItem[]>([blankItem(0)]);
  const [taxRate, setTaxRate] = useState(profile?.tax_rate || 0);
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState<InvoiceStatus>('draft');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDays(todayISO(), 30));
  const [clientId, setClientId] = useState<string>('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment due within 30 days of issue.');
  const [clientPhone, setClientPhone] = useState('');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [fees, setFees] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [documentType, setDocumentType] = useState<DocumentType>(initialDocType || 'invoice');
  const [showAIMode, setShowAIMode] = useState(!!aiMode);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [recurringEnabled, setRecurringEnabled] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<RecurringInterval>('monthly');
  const [warranty, setWarranty] = useState('');
  const [dictating, setDictating] = useState(false);
  const [showPasteFill, setShowPasteFill] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [industryId, setIndustryId] = useState<IndustryId>(
    (profile?.industry_template as IndustryId) || 'general'
  );
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const notesRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseNotesRef = useRef('');

  // ── Autosave refs (effects defined after totals/existingInvoice below) ──
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isManualSavingRef = useRef(false);
  const lastAutosaveRef = useRef<string>('');

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // AI mode: parse description and populate fields for review
  const handleAIGenerate = useCallback(() => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setTimeout(() => {
      try {
        const parsed = parseInvoiceText(aiInput);
        if (parsed.clientName) setClientName(parsed.clientName);
        if (parsed.clientEmail) setClientEmail(parsed.clientEmail);
        if (parsed.clientPhone) setClientPhone(parsed.clientPhone);
        if (parsed.clientAddress) setClientAddress(parsed.clientAddress);
        if (parsed.invoiceDate) setIssueDate(parsed.invoiceDate);
        if (parsed.dueDate) setDueDate(parsed.dueDate);
        if (parsed.workOrderNumber) setWorkOrderNumber(parsed.workOrderNumber);
        if (parsed.technicianName) setTechnicianName(parsed.technicianName);
        if (parsed.taxRate !== null) setTaxRate(parsed.taxRate);
        if (parsed.terms) setTerms(parsed.terms);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.warranty) setWarranty(parsed.warranty);
        if (parsed.items.length > 0) {
          setItems(parsed.items.map((item, i) => ({
            ...blankItem(i),
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          })));
        }
        const detected = detectIndustryFromItems(
          parsed.items.map(i => i.description),
          parsed.notes || '',
          parsed.technicianName || '',
          parsed.workOrderNumber || '',
        );
        if (detected !== 'general') {
          setIndustryId(detected);
          const tmpl = getIndustryTemplate(detected);
          setTerms(tmpl.defaultTerms);
          setWarranty(tmpl.defaultWarranty);
        }
        const tradeResult = suggestFromNotes(aiInput, detected, []);
        if (tradeResult.warranty && !parsed.warranty) setWarranty(tradeResult.warranty);
        if (tradeResult.technician && !parsed.technicianName) setTechnicianName(tradeResult.technician);
        setShowAIMode(false);
        setAiLoading(false);
      } catch {
        setAiError('Could not parse the description. Try rephrasing or add more detail.');
        setAiLoading(false);
      }
    }, 600);
  }, [aiInput]);

  const professionalize = useCallback((text: string): string => {
    let cleaned = text.trim();
    if (!cleaned) return '';
    cleaned = cleaned.replace(/\b(um|uh|er|ah|hmm|huh|like|you know|i mean|sort of|kind of|basically|literally|actually)\b/gi, '');
    cleaned = cleaned.replace(/\bi\b/g, 'I');
    cleaned = cleaned.replace(/^\s*[a-z]/, m => m.toUpperCase());
    cleaned = cleaned.replace(/([.!?]\s+)([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/\s+([,.!?;:])/g, '$1');
    return cleaned;
  }, []);

  const toggleNotesDictation = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    if (dictating) {
      notesRecognitionRef.current?.stop();
      setDictating(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    baseNotesRef.current = notes;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript + ' ';
        else interimText += result[0].transcript;
      }
      const base = baseNotesRef.current.trim();
      const spokenFinal = professionalize(finalText.trim());
      const combined = [base, spokenFinal, interimText].filter(Boolean).join(' ');
      setNotes(combined);
    };
    recognition.onend = () => {
      setNotes(prev => {
        const polished = professionalize(prev);
        if (polished && !/[.!?]$/.test(polished)) return polished + '.';
        return polished;
      });
      setDictating(false);
    };
    recognition.onerror = () => setDictating(false);

    notesRecognitionRef.current = recognition;
    try { recognition.start(); setDictating(true); } catch { /* mic permission denied or unsupported */ }
  }, [dictating, notes, professionalize]);

  const existingInvoice = useMemo(
    () => invoices.find(inv => inv.id === invoiceId),
    [invoices, invoiceId],
  );

  useEffect(() => {
    if (existingInvoice) {
      setItems(existingInvoice.invoice_items?.length
        ? existingInvoice.invoice_items.map(it => ({
          ...it,
          item_type: it.item_type || 'service',
          unit: it.unit || 'ea',
          tax_rate: it.tax_rate ?? null,
          discount_amount: it.discount_amount || 0,
          notes: it.notes || null,
        }))
        : [blankItem(0)]
      );
      setTaxRate(existingInvoice.tax_rate || 0);
      setDiscount(existingInvoice.discount_amount || 0);
      setStatus(existingInvoice.status);
      setIssueDate(existingInvoice.issue_date || todayISO());
      setDueDate(existingInvoice.due_date || addDays(todayISO(), 30));
      setClientId(existingInvoice.client_id || '');
      setClientName(existingInvoice.client_name || '');
      setClientEmail(existingInvoice.client_email || '');
      setClientAddress(existingInvoice.client_address || '');
      setNotes(existingInvoice.notes || '');
      setTerms(existingInvoice.terms || 'Payment due within 30 days of issue.');
      setClientPhone(existingInvoice.client_phone || '');
      setWorkOrderNumber(existingInvoice.work_order_number || '');
      setTechnicianName(existingInvoice.technician_name || '');
      setFees(existingInvoice.fees_amount || 0);
      setShipping(existingInvoice.shipping_amount || 0);
      setDeposit(existingInvoice.deposit_amount || 0);
      setDocumentType(existingInvoice.document_type || 'invoice');
      setRecurringEnabled(existingInvoice.recurring_enabled || false);
      setRecurringInterval(existingInvoice.recurring_interval || 'monthly');
      setWarranty(existingInvoice.warranty || '');
      setIndustryId((existingInvoice.industry_template as IndustryId) || 'general');
      setMetadata(existingInvoice.metadata || {});
      setLoading(false);
    } else if (!invoiceId) {
      setLoading(false);
    }
  }, [existingInvoice, invoiceId]);

  const totals = useMemo(() => recalcInvoice(items, taxRate, discount, fees, shipping, deposit), [items, taxRate, discount, fees, shipping, deposit]);

  // ── Autosave payload + debounced effect (after totals & existingInvoice) ──
  const buildAutosavePayload = useCallback(() => {
    return {
      client_id: clientId || null,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || null,
      client_address: clientAddress,
      work_order_number: workOrderNumber || null,
      technician_name: technicianName || null,
      status,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal: totals.subtotal,
      tax_rate: taxRate,
      tax_amount: totals.taxAmount,
      discount_amount: discount,
      fees_amount: fees,
      shipping_amount: shipping,
      deposit_amount: deposit,
      document_type: documentType,
      recurring_enabled: recurringEnabled,
      recurring_interval: recurringEnabled ? recurringInterval : null,
      total: totals.total,
      notes: notes || null,
      terms: terms || null,
      warranty: warranty || null,
      metadata,
      industry_template: industryId,
    };
  }, [clientId, clientName, clientEmail, clientPhone, clientAddress, workOrderNumber, technicianName, status, issueDate, dueDate, totals, taxRate, discount, fees, shipping, deposit, documentType, recurringEnabled, recurringInterval, notes, terms, warranty, metadata, industryId]);

  useEffect(() => {
    if (!existingInvoice) return;
    if (existingInvoice.status !== 'draft') return;
    if (isManualSavingRef.current) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      if (isManualSavingRef.current) return;

      const payload = buildAutosavePayload();
      const signature = JSON.stringify(payload);
      if (signature === lastAutosaveRef.current) return;
      lastAutosaveRef.current = signature;

      setAutosaveStatus('saving');
      const itemsData = items.map(it => ({
        ...it,
        item_type: it.item_type || 'service',
        unit: it.unit || 'ea',
        tax_rate: it.tax_rate ?? null,
        discount_amount: it.discount_amount || 0,
        notes: it.notes || null,
      }));
      const result = await update(existingInvoice.id, payload, itemsData);
      if (!isMountedRef.current) return;
      if (result) {
        setAutosaveStatus('saved');
        setTimeout(() => { if (isMountedRef.current) setAutosaveStatus('idle'); }, 2500);
      } else {
        setAutosaveStatus('error');
      }
    }, 2000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [existingInvoice, buildAutosavePayload, items, update]);

  const industryTemplate = useMemo(() => getIndustryTemplate(industryId), [industryId]);

  const runAutoDetect = useCallback(() => {
    const descriptions = items.map(i => i.description || '');
    const detected = detectIndustryFromItems(descriptions, notes, technicianName, workOrderNumber);
    if (detected !== 'general' && detected !== industryId) {
      setIndustryId(detected);
      const tmpl = getIndustryTemplate(detected);
      const combinedText = [notes, ...descriptions, technicianName, workOrderNumber].join(' ');
      const fields = extractIndustryFields(combinedText, tmpl);
      if (Object.keys(fields).length > 0) {
        setMetadata(prev => ({ ...prev, ...fields }));
      }
      setAutoDetectNotice(`Detected ${tmpl.label} invoice — switched template automatically.`);
      setTimeout(() => setAutoDetectNotice(null), 5000);
    }
  }, [items, notes, technicianName, workOrderNumber, industryId]);

  const handleIndustryChange = useCallback((id: IndustryId) => {
    setIndustryId(id);
    const tmpl = getIndustryTemplate(id);
    const preset = defaultItemPresetFor(id);
    setTerms(tmpl.defaultTerms);
    setWarranty(tmpl.defaultWarranty);
    setItems(prev => prev.map(item =>
      item.description.trim() === '' && item.unit_price === 0
        ? { ...item, item_type: preset.itemType, unit: preset.unit }
        : item
    ));
    const combinedText = [notes, ...items.map(i => i.description), technicianName, workOrderNumber].join(' ');
    const fields = extractFieldsFromText(combinedText, id);
    if (Object.keys(fields).length > 0) {
      setMetadata(prev => ({ ...prev, ...fields }));
    }
    setAutoDetectNotice(`${tmpl.label} template applied — terms, warranty, and defaults configured.`);
    setTimeout(() => setAutoDetectNotice(null), 4000);
  }, [notes, items, technicianName, workOrderNumber]);

  const runAISuggest = useCallback(() => {
    if (!notes.trim()) {
      setSuggestNotice('Add some work notes first, then I can draft items and fields from them.');
      setTimeout(() => setSuggestNotice(null), 4000);
      return;
    }
    setSuggesting(true);
    setTimeout(() => {
      const result = suggestFromNotes(notes, industryId, items);
      if (result.items.length === 0 && Object.keys(result.fields).length === 0) {
        setSuggestNotice('Nothing to suggest yet — try adding more detail to your work notes.');
      } else {
        setSuggestions(result.items.length > 0 ? result.items : null);
        if (Object.keys(result.fields).length > 0) {
          setMetadata(prev => ({ ...prev, ...result.fields }));
        }
        if (result.technician && !technicianName) setTechnicianName(result.technician);
        if (result.workOrder && !workOrderNumber) setWorkOrderNumber(result.workOrder);
        if (result.warranty && !warranty) setWarranty(result.warranty);
        const count = result.items.length + Object.keys(result.fields).length;
        setSuggestNotice(count > 0
          ? `Drafted ${result.items.length} item${result.items.length !== 1 ? 's' : ''} and ${Object.keys(result.fields).length} field${Object.keys(result.fields).length !== 1 ? 's' : ''} from your notes.`
          : 'Filled in details from your notes.');
      }
      setSuggesting(false);
      setTimeout(() => setSuggestNotice(null), 6000);
    }, 500);
  }, [notes, industryId, items, technicianName, workOrderNumber, warranty]);

  const acceptSuggestion = useCallback((s: SuggestedItem) => {
    setItems(prev => {
      const hasBlank = prev.some(it => it.description.trim() === '' && it.unit_price === 0);
      const newItem: InvoiceItem = {
        ...blankItem(prev.length),
        description: s.description,
        quantity: s.quantity,
        unit_price: s.unit_price,
        item_type: s.item_type,
        unit: s.unit,
        total: calcItemTotal({ quantity: s.quantity, unit_price: s.unit_price, discount_amount: 0 } as InvoiceItem),
        notes: null,
      };
      if (hasBlank) {
        return prev.map(it => it.description.trim() === '' && it.unit_price === 0 ? newItem : it);
      }
      return [...prev, newItem];
    });
    setSuggestions(prev => prev ? prev.filter(x => x !== s) : null);
  }, []);

  const acceptAllSuggestions = useCallback(() => {
    if (!suggestions) return;
    setItems(prev => {
      const filtered = prev.filter(it => !(it.description.trim() === '' && it.unit_price === 0));
      const additions = suggestions.map((s, i) => ({
        ...blankItem(filtered.length + i),
        description: s.description,
        quantity: s.quantity,
        unit_price: s.unit_price,
        item_type: s.item_type,
        unit: s.unit,
        total: calcItemTotal({ quantity: s.quantity, unit_price: s.unit_price, discount_amount: 0 } as InvoiceItem),
        notes: null,
      }));
      return additions.length > 0 ? [...filtered, ...additions] : prev;
    });
    setSuggestions(null);
  }, [suggestions]);

  const updateMetadata = useCallback((key: string, value: string) => {
    setMetadata(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateItem = useCallback((index: number, field: keyof InvoiceItem, value: string | number | null) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      updated.total = calcItemTotal(updated);
      return updated;
    }));
  }, []);

  const addRow = useCallback(() => {
    setItems(prev => [...prev, blankItem(prev.length)]);
  }, []);

  const addFlatRow = useCallback(() => {
    setItems(prev => [
      ...prev,
      { ...blankItem(prev.length), description: '', quantity: 1, unit_price: 0, total: 0, unit: 'flat' },
    ]);
  }, []);

  const addProductToInvoice = useCallback((product: Product) => {
    setItems(prev => [...prev, {
      description: product.name + (product.description ? ` — ${product.description}` : ''),
      quantity: 1,
      unit_price: product.unit_price,
      total: product.unit_price,
      sort_order: prev.length,
      item_type: product.item_type,
      unit: product.unit,
      tax_rate: product.tax_rate,
      discount_amount: 0,
      notes: null,
    }]);
    setShowCatalog(false);
  }, []);

  const removeRow = useCallback((index: number) => {
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }, []);

  const selectClient = useCallback((id: string) => {
    setClientId(id);
    if (id) {
      const client = clients.find(c => c.id === id);
      if (client) {
        setClientName(client.name);
        setClientEmail(client.email || '');
        setClientPhone(client.phone || '');
        setClientAddress(client.address || '');
      }
    } else {
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setClientAddress('');
    }
  }, [clients]);

  const handlePasteFill = useCallback(() => {
    if (!pasteText.trim()) return;
    setParsing(true);
    setTimeout(() => {
      const parsed = parseInvoiceText(pasteText);
      if (parsed.clientName) setClientName(parsed.clientName);
      if (parsed.clientPhone) setClientPhone(parsed.clientPhone);
      if (parsed.clientEmail) setClientEmail(parsed.clientEmail);
      if (parsed.clientAddress) setClientAddress(parsed.clientAddress);
      if (parsed.invoiceDate) setIssueDate(parsed.invoiceDate);
      if (parsed.dueDate) setDueDate(parsed.dueDate);
      if (parsed.workOrderNumber) setWorkOrderNumber(parsed.workOrderNumber);
      if (parsed.technicianName) setTechnicianName(parsed.technicianName);
      if (parsed.taxRate !== null) setTaxRate(parsed.taxRate);
      if (parsed.discount !== null) setDiscount(parsed.discount);
      if (parsed.fees !== null) setFees(parsed.fees);
      if (parsed.terms) setTerms(parsed.terms);
      if (parsed.notes) setNotes(parsed.notes);
      if (parsed.warranty) setWarranty(parsed.warranty);
      if (parsed.items.length > 0) {
        setItems(parsed.items.map((item, i) => ({
          ...blankItem(i),
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
        })));
      }

      const detected = detectIndustryFromItems(
        parsed.items.map(i => i.description),
        parsed.notes || '',
        parsed.technicianName || '',
        parsed.workOrderNumber || '',
      );
      if (detected !== 'general') {
        setIndustryId(detected);
        const tmpl = getIndustryTemplate(detected);
        const fields = extractIndustryFields(pasteText, tmpl);
        if (Object.keys(fields).length > 0) {
          setMetadata(prev => ({ ...prev, ...fields }));
        }
        setAutoDetectNotice(`Detected ${tmpl.label} invoice — fields adapted automatically.`);
        setTimeout(() => setAutoDetectNotice(null), 5000);
      }

      setParsing(false);
      setShowPasteFill(false);
      setPasteText('');
    }, 400);
  }, [pasteText]);

  const handleSave = useCallback(async () => {
    if (!existingInvoice && !canCreateInvoice(tier, invoices.length)) {
      setShowUpgrade(true);
      return;
    }

    isManualSavingRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setSaving(true);
    setSaveError(null);
    const invoiceData = {
      invoice_number: existingInvoice?.invoice_number || generateInvoiceNumber(profile?.invoice_prefix || 'INV', profile?.next_invoice_number || 1),
      estimate_number: documentType === 'estimate' && !existingInvoice?.estimate_number
        ? `EST-${String(profile?.next_invoice_number || 1).padStart(4, '0')}`
        : existingInvoice?.estimate_number || null,
      client_id: clientId || null,
      client_name: clientName,
      client_email: clientEmail,
      client_phone: clientPhone || null,
      client_address: clientAddress,
      work_order_number: workOrderNumber || null,
      technician_name: technicianName || null,
      status,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal: totals.subtotal,
      tax_rate: taxRate,
      tax_amount: totals.taxAmount,
      discount_amount: discount,
      fees_amount: fees,
      shipping_amount: shipping,
      deposit_amount: deposit,
      document_type: documentType,
      recurring_enabled: recurringEnabled,
      recurring_interval: recurringEnabled ? recurringInterval : null,
      total: totals.total,
      notes: notes || null,
      terms: terms || null,
      warranty: warranty || null,
      metadata: metadata,
      industry_template: industryId,
      stripe_payment_intent_id: existingInvoice?.stripe_payment_intent_id || null,
      stripe_checkout_session_id: existingInvoice?.stripe_checkout_session_id || null,
      payment_status: existingInvoice?.payment_status || 'unpaid',
      hearth_status: existingInvoice?.hearth_status || null,
      hearth_application_url: existingInvoice?.hearth_application_url || null,
      parent_invoice_id: existingInvoice?.parent_invoice_id || null,
      recurring_next_date: existingInvoice?.recurring_next_date || null,
      converted_at: existingInvoice?.converted_at || null,
    };

    const itemsData = items.map(it => ({
      ...it,
      item_type: it.item_type || 'service',
      unit: it.unit || 'ea',
      tax_rate: it.tax_rate ?? null,
      discount_amount: it.discount_amount || 0,
      notes: it.notes || null,
    }));

    let result;
    if (existingInvoice) {
      result = await update(existingInvoice.id, invoiceData, itemsData);
    } else {
      result = await create(invoiceData, itemsData);
      const lastError = (create as unknown as { _lastError?: string })._lastError;
      if (!result && lastError) {
        setSaveError(lastError);
        setSaving(false);
        return;
      }
      if (result && profile) {
        await supabase
          .from('business_profile')
          .update({ next_invoice_number: (profile.next_invoice_number || 1) + 1 })
          .eq('id', profile.id);
      }
    }

    setSaving(false);
    isManualSavingRef.current = false;
    if (result) {
      setSavedId(result.id);
      setTimeout(() => onNavigate({ name: 'preview', invoiceId: result.id }), 600);
    }
  }, [existingInvoice, profile, tier, invoices.length, clientId, clientName, clientEmail, clientPhone, clientAddress, workOrderNumber, technicianName, fees, shipping, deposit, documentType, recurringEnabled, recurringInterval, warranty, status, issueDate, dueDate, totals, taxRate, discount, notes, terms, items, industryId, metadata, create, update, onNavigate]);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded-lg mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const accent = profile?.accent_color || '#111827';
  const activeProducts = products.filter(p => p.is_active);

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-5xl mx-auto animate-fade-in pb-32 md:pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button onClick={() => onNavigate({ name: 'invoices' })} className="btn-ghost px-2.5 shrink-0 min-touch">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold text-slate-900 truncate">
              {existingInvoice ? `Edit ${documentType === 'estimate' ? 'Estimate' : 'Invoice'}` : `New ${documentType === 'estimate' ? 'Estimate' : 'Invoice'}`}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 truncate">
              {existingInvoice?.invoice_number || generateInvoiceNumber(profile?.invoice_prefix || 'INV', profile?.next_invoice_number || 1)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {savedId && (
            <span className="text-xs md:text-sm text-emerald-600 font-medium flex items-center gap-1 animate-fade-in">
              Saved!
            </span>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary min-touch hidden md:flex">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      {/* Autosave status + error */}
      {existingInvoice && existingInvoice.status === 'draft' && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          {autosaveStatus === 'saving' && (
            <span className="text-slate-500 flex items-center gap-1.5 animate-fade-in" role="status" aria-live="polite">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving draft…
            </span>
          )}
          {autosaveStatus === 'saved' && (
            <span className="text-emerald-600 flex items-center gap-1.5 animate-fade-in" role="status" aria-live="polite">
              <Check className="w-3.5 h-3.5" /> Draft saved
            </span>
          )}
          {autosaveStatus === 'error' && (
            <span className="text-red-600 flex items-center gap-2 animate-fade-in" role="alert">
              <span>Could not save automatically.</span>
              <button
                onClick={() => { setAutosaveStatus('idle'); handleSave(); }}
                className="font-semibold underline hover:text-red-700"
              >
                Retry
              </button>
            </span>
          )}
        </div>
      )}
      {saveError && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 animate-fade-in flex items-center justify-between">
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 ml-2">Dismiss</button>
        </div>
      )}

      {/* Create with AI — review-first panel */}
      {showAIMode && (
        <div className="card mb-6 p-5 md:p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}15`, color: accent }}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  Create with AI
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: accent }}>
                    AI
                  </span>
                </h2>
                <p className="text-sm text-slate-500">Describe the job and AI will draft the invoice for your review</p>
              </div>
            </div>
            <button onClick={() => setShowAIMode(false)} className="text-slate-400 hover:text-slate-600 p-1.5 min-touch">
              <X className="w-5 h-5" />
            </button>
          </div>
          <textarea
            value={aiInput}
            onChange={e => setAiInput(e.target.value)}
            placeholder={'Describe the work you did. For example:\n\nRepaired a leaking kitchen sink for John Smith at 456 Oak Ave. Replaced the P-trap and supply line. 1.5 hours labor at $95/hr. Parts: P-trap $35, supply line $22. 8.25% sales tax. 90-day warranty on parts and labor.'}
            rows={6}
            className="input resize-none text-sm"
            autoFocus
          />
          {aiError && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5 animate-fade-in" role="alert">
              <AlertCircle className="w-4 h-4" /> {aiError}
            </p>
          )}
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              AI fills fields for your review — nothing is sent until you save
            </p>
            <button
              onClick={handleAIGenerate}
              disabled={!aiInput.trim() || aiLoading}
              className="btn-primary text-sm min-touch"
              style={{ background: accent }}
            >
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
              ) : (
                <><Wand2 className="w-4 h-4" /> Draft Invoice</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* AI Paste & Fill */}
      <div className="card mb-6 overflow-hidden">
        <button
          onClick={() => setShowPasteFill(!showPasteFill)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${accent}15`, color: accent }}
            >
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                AI Paste & Fill
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: accent }}>
                  AI
                </span>
              </h2>
              <p className="text-sm text-slate-500">Paste invoice text and AI fills every field automatically</p>
            </div>
          </div>
          {showPasteFill ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        {showPasteFill && (
          <div className="px-6 pb-6 animate-slide-up">
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={'Paste any invoice text here. For example:\n\nInvoice #: INV-0042\nDate: 07/31/2026\nDue Date: 08/30/2026\nWork Order: WO-789\nTechnician: Mike Johnson\n\nBill To: John Smith\nAddress: 456 Oak Ave, Springfield, IL 62704\nPhone: (217) 555-0199\nEmail: john.smith@email.com\n\nLine Items:\nFurnace repair          1    250.00\nReplacement filter      2     35.00\nLabor (2 hrs)           2     95.00\n\nSubtotal: 615.00\nTax (8%): 49.20\nService fee: 50.00\nTotal: 714.20\n\nTerms: Payment due within 30 days.\nNotes: Please keep area clear for 24 hours.\nWarranty: 90-day warranty on all parts and labor.'}
              rows={10}
              className="input resize-none font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" style={{ color: accent }} />
                AI will extract all fields and fill them in automatically
              </p>
              <button
                onClick={handlePasteFill}
                disabled={!pasteText.trim() || parsing}
                className="btn-primary text-sm"
                style={{ background: accent }}
              >
                {parsing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Parsing...</>
                ) : (
                  <><Wand2 className="w-4 h-4" /> Fill Invoice</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bill To */}
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              Bill To
            </h2>
            <div className="space-y-3">
              <div>
                <label className="label">Select existing client</label>
                <select
                  value={clientId}
                  onChange={e => selectClient(e.target.value)}
                  className="input"
                >
                  <option value="">— New client —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Client name</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Acme Corp" className="input" />
                </div>
                <div>
                  <label className="label">Client email</label>
                  <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="billing@acme.com" className="input" />
                </div>
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    Client phone
                  </label>
                  <input type="tel" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(555) 123-4567" className="input" />
                </div>
                <div>
                  <label className="label">Client address</label>
                  <input type="text" value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="123 Main St, Springfield, IL 62704" className="input" />
                </div>
              </div>
            </div>
          </div>

          {/* Industry template */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-900">Invoice Template</h2>
              <button
                type="button"
                onClick={runAutoDetect}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                title="Auto-detect industry from your descriptions"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Auto-detect
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INDUSTRY_LIST.map(tmpl => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleIndustryChange(tmpl.id)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    industryId === tmpl.id
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="block">{tmpl.label}</span>
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">{tmpl.tagline}</span>
                </button>
              ))}
            </div>

            {/* Industry-specific custom fields */}
            {industryTemplate.customFields.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  {industryTemplate.label} Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {industryTemplate.customFields.map(field => (
                    <div key={field.key} className={field.full ? 'sm:col-span-2' : ''}>
                      <label className="label flex items-center gap-1.5">
                        {field.label}
                        {field.optional && <span className="text-[10px] font-normal text-slate-400">(optional)</span>}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={metadata[field.key] || ''}
                          onChange={e => updateMetadata(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={2}
                          className="input resize-none"
                        />
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                          value={metadata[field.key] || ''}
                          onChange={e => updateMetadata(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="input"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">Line Items</h2>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={runAISuggest}
                  disabled={suggesting}
                  className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-white transition-all disabled:opacity-60"
                  style={{ background: accent }}
                  title="Draft line items and fields from your work notes"
                >
                  {suggesting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI Suggest
                    </>
                  )}
                </button>
                {activeProducts.length > 0 && (
                  <button onClick={() => setShowCatalog(true)} className="btn-ghost text-sm text-slate-700 hover:bg-slate-100">
                    <Package className="w-4 h-4" />
                    Catalog
                  </button>
                )}
                <button onClick={addRow} className="btn-ghost text-sm text-slate-900 hover:bg-slate-100">
                  <Plus className="w-4 h-4" />
                  Add row
                </button>
                <button onClick={addFlatRow} className="btn-ghost text-sm text-slate-900 hover:bg-slate-100">
                  <DollarSign className="w-4 h-4" />
                  Flat price
                </button>
              </div>
            </div>

            {/* Notices */}
            {(suggestNotice || autoDetectNotice) && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 animate-slide-up">
                <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-sm text-slate-600">{suggestNotice || autoDetectNotice}</p>
              </div>
            )}

            {/* AI suggestion cards */}
            {suggestions && suggestions.length > 0 && (
              <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white animate-slide-up">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: accent }} />
                    <p className="text-sm font-semibold text-slate-800">Suggested from your notes</p>
                    <span className="text-xs font-medium text-slate-400">{suggestions.length} item{suggestions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={acceptAllSuggestions}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white transition-colors"
                      style={{ background: accent }}
                    >
                      Add all
                    </button>
                    <button
                      onClick={() => setSuggestions(null)}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600 px-2.5 py-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {suggestions.map((s, idx) => {
                    const tm = TYPE_META[s.item_type] || TYPE_META.other;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 transition-colors">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${tm.bg} ${tm.color} shrink-0`}>
                          {tm.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{s.description}</p>
                          <p className="text-xs text-slate-400">{s.quantity} {s.unit} × {formatCurrency(s.unit_price, symbol)}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-700 shrink-0">{formatCurrency(s.quantity * s.unit_price, symbol)}</span>
                        <button
                          onClick={() => acceptSuggestion(s)}
                          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product catalog picker */}
            {showCatalog && (
              <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50 animate-slide-up">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-700">Pick from your catalog</p>
                  <button onClick={() => setShowCatalog(false)} className="text-slate-400 hover:text-slate-600 text-sm">Close</button>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {activeProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addProductToInvoice(p)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-400 hover:shadow-sm transition-all text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700 truncate">{p.name}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">{p.item_type}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm text-slate-600">{formatCurrency(p.unit_price, symbol)}</span>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Column headers */}
            <div className="hidden md:flex items-center gap-2 px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
              <div className="w-20 shrink-0">Type</div>
              <div className="flex-1 min-w-0">Description</div>
              <div className="w-16 text-center shrink-0">Qty</div>
              <div className="w-24 text-right shrink-0">Price</div>
              <div className="w-24 text-right shrink-0">Amount</div>
              <div className="w-12 shrink-0" />
            </div>

            <div className="space-y-2">
              {items.map((item, i) => {
                const tm = TYPE_META[item.item_type] || TYPE_META.other;
                const isOpen = expandedItem === i;
                const isFlatRow = item.unit === 'flat';
                return (
                <div key={i} className="animate-fade-in">
                  {isFlatRow ? (
                    /* ── Flat price row ─────────────────────────────────────── */
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
                      <span className="w-20 shrink-0 text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg bg-blue-100 text-blue-700 text-center select-none">Price</span>

                      {/* Optional label */}
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                          placeholder="Label (optional)"
                          className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>

                      {/* Direct price input — writes straight to unit_price */}
                      <div className="relative shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold pointer-events-none">{symbol}</span>
                        <input
                          type="number"
                          value={item.unit_price || ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0;
                            setItems(prev => prev.map((it, idx) =>
                              idx === i ? { ...it, unit_price: v, total: v } : it
                            ));
                          }}
                          min="0"
                          step="any"
                          placeholder="0.00"
                          autoFocus={item.unit_price === 0}
                          className="w-36 text-sm font-semibold text-right bg-white border border-blue-200 rounded-lg pl-6 pr-3 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 focus:outline-none"
                        />
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeRow(i)}
                        disabled={items.length === 1}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                  <div className={`flex items-center gap-2 bg-white rounded-xl border px-3 py-2.5 transition-all group ${isOpen ? 'border-slate-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                    {/* Type badge button — cycles type on click */}
                    <button
                      onClick={() => {
                        const types: ItemType[] = ['service', 'product', 'labor', 'other'];
                        const next = types[(types.indexOf(item.item_type) + 1) % types.length];
                        updateItem(i, 'item_type', next);
                      }}
                      className={`w-20 shrink-0 text-[10px] font-bold uppercase px-2 py-1.5 rounded-lg ${tm.bg} ${tm.color} hover:opacity-80 transition-opacity cursor-pointer text-center`}
                      title="Click to change type"
                    >
                      {tm.label}
                    </button>

                    {/* Description */}
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(i, 'description', e.target.value)}
                        placeholder="What was this item?"
                        className="w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      />
                      {item.notes && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{item.notes}</p>
                      )}
                    </div>

                    {/* Qty */}
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="any"
                      placeholder="1"
                      className="w-14 md:w-16 text-sm text-center bg-slate-50 rounded-lg px-2 py-1.5 border border-transparent focus:border-slate-300 focus:bg-white focus:outline-none shrink-0"
                    />

                    {/* Unit price */}
                    <div className="relative w-20 md:w-24 shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">{symbol}</span>
                      <input
                        type="number"
                        value={item.unit_price || ''}
                        onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="any"
                        placeholder="0.00"
                        className="w-full text-sm text-right bg-slate-50 rounded-lg pl-5 pr-2 py-1.5 border border-transparent focus:border-slate-300 focus:bg-white focus:outline-none"
                      />
                    </div>

                    {/* Amount */}
                    <div className="w-20 md:w-24 text-right shrink-0">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(item.total, symbol)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0 w-12 justify-end">
                      <button
                        onClick={() => setExpandedItem(isOpen ? null : i)}
                        className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'text-slate-700 bg-slate-100' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'}`}
                        title="More options"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        onClick={() => removeRow(i)}
                        disabled={items.length === 1}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  )}

                  {/* Expanded details — only for regular rows */}
                  {!isFlatRow && isOpen && (
                    <div className="mt-1 mx-0.5 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-slide-up">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="label text-xs">Type</label>
                          <select
                            value={item.item_type}
                            onChange={e => updateItem(i, 'item_type', e.target.value)}
                            className="input text-sm py-1.5"
                          >
                            {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Unit</label>
                          <select
                            value={item.unit}
                            onChange={e => updateItem(i, 'unit', e.target.value)}
                            className="input text-sm py-1.5"
                          >
                            {(industryTemplate.defaultUnits.length > 0 ? industryTemplate.defaultUnits : UNITS).map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label text-xs">Line discount (%)</label>
                          <input
                            type="number"
                            value={item.discount_amount || ''}
                            onChange={e => updateItem(i, 'discount_amount', Math.min(100, parseFloat(e.target.value) || 0))}
                            min="0"
                            max="100"
                            step="0.1"
                            className="input text-right text-sm py-1.5"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="label text-xs">Tax % override</label>
                          <input
                            type="number"
                            value={item.tax_rate ?? ''}
                            onChange={e => updateItem(i, 'tax_rate', e.target.value === '' ? null : parseFloat(e.target.value))}
                            min="0"
                            step="0.01"
                            className="input text-right text-sm py-1.5"
                            placeholder="Use invoice default"
                          />
                        </div>
                        <div className="col-span-2 md:col-span-4">
                          <label className="label text-xs">Note shown on invoice</label>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={e => updateItem(i, 'notes', e.target.value || null)}
                            className="input text-sm py-1.5"
                            placeholder="e.g. Color, size, SKU"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>

            {/* Mobile column hint */}
            <p className="md:hidden mt-2 text-[11px] text-slate-400 text-center">Tap a type badge to change it. Tap the chevron for options.</p>

            <button
              onClick={addRow}
              className="w-full mt-3 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:border-slate-400 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add line item
            </button>
          </div>

          {/* Work Done, Terms & Warranty */}
          <div className="card p-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">{industryTemplate.detailLabels.notes || 'Work Done'}</label>
                <button
                  type="button"
                  onClick={toggleNotesDictation}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                    dictating
                      ? 'bg-red-50 text-red-600'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={dictating ? 'Stop dictation' : 'Dictate work done with your voice'}
                >
                  {dictating ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
                  {dictating ? 'Stop' : 'Dictate'}
                  {dictating && (
                    <span className="flex gap-0.5 ml-0.5">
                      <span className="w-1 h-2.5 bg-red-400 rounded-full animate-pulse" />
                      <span className="w-1 h-3 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-2 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </span>
                  )}
                </button>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Describe the work completed..."
                rows={3}
                className={`input resize-none ${dictating ? 'ring-2 ring-red-400/30 border-red-300' : ''}`}
              />
            </div>
            <div>
              <label className="label">{industryTemplate.detailLabels.terms || 'Terms & Conditions'}</label>
              <textarea
                value={terms}
                onChange={e => setTerms(e.target.value)}
                placeholder="Payment terms, due date policy..."
                rows={2}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                {industryTemplate.detailLabels.warranty || 'Warranty / Guarantee'}
              </label>
              <textarea
                value={warranty}
                onChange={e => setWarranty(e.target.value)}
                placeholder="90-day warranty on all parts and labor..."
                rows={2}
                className="input resize-none"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">Details</h2>
            <div>
              <label className="label">Document type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDocumentType('invoice')}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${documentType === 'invoice' ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentType('estimate')}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${documentType === 'estimate' ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  Estimate
                </button>
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as InvoiceStatus)} className="input">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Issue date
              </label>
              <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Due date
              </label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-slate-400" />
                {industryTemplate.detailLabels.workOrder || 'Work order #'}
              </label>
              <input type="text" value={workOrderNumber} onChange={e => setWorkOrderNumber(e.target.value)} placeholder="WO-789" className="input" />
            </div>
            <div>
              <label className="label flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {industryTemplate.detailLabels.technician || 'Technician'}
              </label>
              <input type="text" value={technicianName} onChange={e => setTechnicianName(e.target.value)} placeholder="Mike Johnson" className="input" />
            </div>
          </div>

          {/* Summary */}
          <div className="card p-6 sticky top-6">
            <h2 className="font-semibold text-slate-900 mb-4">Summary</h2>
            {documentType === 'invoice' && (
              <label className="flex items-center gap-3 p-3 mb-3 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={recurringEnabled}
                  onChange={e => setRecurringEnabled(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: accent }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-700">Recurring invoice</p>
                  <p className="text-xs text-slate-400">Auto-generate on a schedule</p>
                </div>
              </label>
            )}
            {recurringEnabled && documentType === 'invoice' && (
              <div className="mb-4">
                <label className="label text-xs">Repeat every</label>
                <select value={recurringInterval} onChange={e => setRecurringInterval(e.target.value as RecurringInterval)} className="input text-sm py-1.5">
                  <option value="weekly">Week</option>
                  <option value="monthly">Month</option>
                  <option value="quarterly">Quarter</option>
                  <option value="yearly">Year</option>
                </select>
              </div>
            )}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCurrency(totals.subtotal, symbol)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">Tax rate</span>
                </div>
                <input
                  type="number"
                  value={taxRate}
                  onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-20 input text-right py-1.5"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">Discount %</span>
                </div>
                <input
                  type="number"
                  value={discount}
                  onChange={e => setDiscount(Math.min(100, parseFloat(e.target.value) || 0))}
                  min="0"
                  max="100"
                  step="0.1"
                  className="w-20 input text-right py-1.5"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">Fees</span>
                </div>
                <input
                  type="number"
                  value={fees}
                  onChange={e => setFees(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-20 input text-right py-1.5"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">Shipping</span>
                </div>
                <input
                  type="number"
                  value={shipping}
                  onChange={e => setShipping(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-20 input text-right py-1.5"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-500">Deposit</span>
                </div>
                <input
                  type="number"
                  value={deposit}
                  onChange={e => setDeposit(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.01"
                  className="w-20 input text-right py-1.5"
                />
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                <span className="text-slate-500">Tax</span>
                <span className="font-medium text-slate-900">{formatCurrency(totals.taxAmount, symbol)}</span>
              </div>
              {fees > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fees</span>
                  <span className="font-medium text-slate-900">{formatCurrency(fees, symbol)}</span>
                </div>
              )}
              {shipping > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Shipping</span>
                  <span className="font-medium text-slate-900">{formatCurrency(shipping, symbol)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-2xl font-bold" style={{ color: accent }}>
                  {formatCurrency(totals.total, symbol)}
                </span>
              </div>
              {deposit > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-sm text-slate-500">Deposit paid</span>
                  <span className="text-sm font-medium text-emerald-600">−{formatCurrency(deposit, symbol)}</span>
                </div>
              )}
              {deposit > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Balance due</span>
                  <span className="text-xl font-bold text-slate-900">{formatCurrency(totals.balanceDue, symbol)}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full mt-6"
              style={{ background: accent }}
            >
              {saving ? 'Saving...' : `Save ${documentType === 'estimate' ? 'Estimate' : 'Invoice'}`}
            </button>
            {existingInvoice && (
              <button
                onClick={() => onNavigate({ name: 'preview', invoiceId: existingInvoice.id })}
                className="btn-secondary w-full mt-2"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature="Creating more invoices" />

      {/* Mobile sticky save bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-4 py-3 safe-area-pb">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full min-touch"
          style={{ background: accent }}
        >
          {saving ? 'Saving...' : `Save ${documentType === 'estimate' ? 'Estimate' : 'Invoice'}`}
        </button>
      </div>
    </div>
  );
}
