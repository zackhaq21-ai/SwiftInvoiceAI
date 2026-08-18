import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Mic, MicOff, ArrowLeft, Sparkles, Plus, Trash2,
  Check, FileText, Loader2, Send, Edit3, X,
  Bot, ChevronRight, ClipboardList, RotateCcw,
} from 'lucide-react';
import { useClients, useBusinessProfile, useInvoices } from '@/lib/hooks';
import { parseVoiceInvoice, generateInvoiceNumber } from '@/lib/voiceParser';
import { formatCurrency, todayISO, addDays, formatDate } from '@/lib/format';
import { calcItemTotal, recalcInvoice } from '@/lib/calc';
import { supabase } from '@/lib/supabase';
import type { InvoiceItem } from '@/lib/types';
import type { View } from '@/App';

interface VoiceInvoiceProps {
  onNavigate: (view: View) => void;
}

type Step =
  | 'greeting'
  | 'client'
  | 'client_confirm'
  | 'item'
  | 'item_price'
  | 'item_confirm'
  | 'more_items'
  | 'tax'
  | 'discount'
  | 'notes'
  | 'due_date'
  | 'review'
  | 'finalizing'
  | 'done';

type MsgRole = 'ai' | 'user';
type MsgType = 'text' | 'client-card' | 'item-card' | 'review-card' | 'success';

interface ChatMessage {
  id: string;
  role: MsgRole;
  type: MsgType;
  content: string;
  data?: ItemCardData | ReviewCardData | SuccessCardData;
}

interface ItemCardData {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  pending: boolean;
}

interface ReviewCardData {
  clientName: string;
  items: InvoiceItem[];
  taxRate: number;
  discount: number;
  notes: string;
  dueDays: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  symbol: string;
}

interface SuccessCardData {
  invoiceNumber: string;
  total: number;
  symbol: string;
}

interface DraftItem {
  description: string;
  quantity: number;
  unit_price: number;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onstart: (() => void) | null;
};

let msgCounter = 0;
function newId(): string {
  msgCounter += 1;
  return `m${msgCounter}`;
}

export default function VoiceInvoice({ onNavigate }: VoiceInvoiceProps) {
  const { clients, create: createClient } = useClients();
  const { profile } = useBusinessProfile();
  const { invoices, create: createInvoice } = useInvoices();
  const symbol = profile?.currency_symbol || '$';
  const accent = profile?.accent_color || '#111827';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<Step>('greeting');
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [aiTyping, setAiTyping] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draftClient, setDraftClient] = useState<string>('');
  const [draftClientId, setDraftClientId] = useState<string | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [draftTax, setDraftTax] = useState<number | null>(null);
  const [draftDiscount, setDraftDiscount] = useState<number | null>(null);
  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const [draftDueDays, setDraftDueDays] = useState(30);
  const [pendingItem, setPendingItem] = useState<DraftItem | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoSendRef = useRef(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesLenRef = useRef(0);

  // ---- Past item suggestions ----
  const pastItemSuggestions = useMemo(() => {
    const descCount: Record<string, number> = {};
    for (const inv of invoices) {
      for (const item of inv.invoice_items || []) {
        const d = item.description.trim();
        if (d) descCount[d] = (descCount[d] || 0) + 1;
      }
    }
    return Object.entries(descCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([desc]) => desc);
  }, [invoices]);

  // ---- Auto-scroll ----
  useEffect(() => {
    if (messages.length !== messagesLenRef.current) {
      messagesLenRef.current = messages.length;
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, aiTyping]);

  // ---- AI message helper with typing delay ----
  const aiSay = useCallback((content: string, type: MsgType = 'text', data?: any) => {
    setAiTyping(true);
    const delay = type === 'text' ? 600 : 900;
    setTimeout(() => {
      setMessages(prev => [...prev, { id: newId(), role: 'ai', type, content, data }]);
      setAiTyping(false);
    }, delay);
  }, []);

  const userSay = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: newId(), role: 'user', type: 'text', content }]);
  }, []);

  // ---- Greeting on mount ----
  useEffect(() => {
    const clientCount = clients.length;
    const hint = clientCount > 0
      ? `\n\nI see you have ${clientCount} saved client${clientCount > 1 ? 's' : ''} — you can pick one or add someone new.`
      : '';
    aiSay(
      `Hi! I'm your invoice assistant. I'll walk you through this step by step — just talk or type, and I'll handle the math and formatting.${hint}\n\nLet's start: who is this invoice for?`,
    );
    setTimeout(() => setStep('client'), 600);
  }, []); // eslint-disable-line

  // ---- Voice recognition ----
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionLike;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (finalText) {
        setInput(prev => (prev + ' ' + finalText).trim());
        shouldAutoSendRef.current = true;
      } else if (interimText) {
        setInput(interimText);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        aiSay("I couldn't access your microphone. You can type instead — just use the text box below.");
      }
    };

    recognition.onend = () => {
      setListening(false);
      if (shouldAutoSendRef.current) {
        shouldAutoSendRef.current = false;
        setTimeout(() => {
          setInput(current => {
            if (current.trim()) {
              processInput(current.trim());
            }
            return '';
          });
        }, 200);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognition.stop(); } catch {}
    };
  }, []); // eslint-disable-line

  const toggleMic = useCallback(() => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
    } else {
      setInput('');
      shouldAutoSendRef.current = false;
      try {
        recognitionRef.current.start();
      } catch {}
    }
  }, [listening]);

  // ---- Suggestion chips per step ----
  const suggestions: string[] = useMemo(() => {
    switch (step) {
      case 'client':
      case 'greeting':
        return clients.slice(0, 4).map(c => c.name);
      case 'item':
        return pastItemSuggestions;
      case 'item_price':
        return [];
      case 'more_items':
        return ['Yes, add another', "No, that's everything"];
      case 'tax':
        return profile?.tax_rate ? [`${profile.tax_rate}%`, '8.25%', 'No tax'] : ['8.25%', '7%', 'No tax'];
      case 'discount':
        return ['No discount', '$50', '$100', '10%'];
      case 'notes':
        return ['No work done notes', 'Payment due within 30 days', '30-day warranty on all work'];
      case 'due_date':
        return ['Net 30', 'Net 15', 'Due on receipt', 'Net 60'];
      default:
        return [];
    }
  }, [step, clients, pastItemSuggestions, profile]);

  // ---- Parse helpers ----
  function extractPriceOnly(text: string): number | null {
    const m = text.match(/\$?\s*(\d[\d,]*\.?\d*)/);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
    return null;
  }

  // ---- Core: process user input based on step ----
  const processInput = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    userSay(clean);
    setInput('');

    switch (step) {
      case 'greeting':
      case 'client': {
        // Allow skip if user doesn't want a client yet
        if (/^(?:skip|no\s+client|none|later)$/i.test(clean)) {
          aiSay("No problem — I'll leave the client blank for now. You can add one later. What's the first item you're billing for?");
          setStep('item');
          return;
        }
        const parsed = parseVoiceInvoice(clean);
        // Also try to grab an email or phone mentioned alongside the name
        const emailMatch = clean.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
        const phoneMatch = clean.match(/(\+?\d[\d\s().-]{8,}\d)/);
        let name = parsed.clientName || clean
          .replace(/^(?:invoice|bill|for|to|from|client|customer)\s+/i, '')
          .replace(emailMatch?.[0] || '__none__', '')
          .replace(phoneMatch?.[0] || '__none__', '')
          .replace(/[,;].*$/, '')
          .trim();
        if (name.length < 2) {
          aiSay("Hmm, I didn't catch a name. Could you tell me who you're billing? For example, 'Acme Corp' or 'Sarah Chen'.");
          return;
        }
        const existing = clients.find(c => c.name.toLowerCase() === name.toLowerCase());
        setDraftClient(name);
        setDraftClientId(existing?.id || null);
        if (existing) {
          aiSay(
            `I found "${existing.name}" in your saved clients. I'll use their details on file. Does that look right?`,
            'client-card',
            { name: existing.name, email: existing.email, phone: existing.phone, address: existing.address, pending: true },
          );
        } else {
          const extra = emailMatch || phoneMatch ? ' I also grabbed their contact info.' : '';
          aiSay(`Got it — billing ${name}.${extra} Is that the correct client name?`, 'client-card', { name, pending: true, email: emailMatch?.[0], phone: phoneMatch?.[0] });
        }
        setStep('client_confirm');
        break;
      }

      case 'item_price': {
        const price = extractPriceOnly(clean);
        if (price === null || price <= 0) {
          aiSay("I didn't catch a price. Could you tell me the amount? For example, '$120' or '150'.");
          return;
        }
        const item = pendingItem ? { ...pendingItem, unit_price: price } : { description: 'Item', quantity: 1, unit_price: price };
        const total = calcItemTotal(item);
        aiSay(`Here's what I've got for this line item:`, 'item-card', { ...item, total, pending: true });
        setPendingItem(item);
        setStep('item_confirm');
        break;
      }

      case 'item': {
        const parsed = parseVoiceInvoice(clean);
        if (parsed.items.length === 0) {
          aiSay("I didn't quite catch that. Try telling me the description, quantity, and price — like '10 hours of development at $120' or 'logo design, 1 at $800 each'.");
          return;
        }
        // Handle multiple items spoken at once: confirm the first, queue the rest
        const first = parsed.items[0];
        const rest = parsed.items.slice(1);
        if (first.unit_price <= 0) {
          setPendingItem(first);
          aiSay(`Got it — ${first.description} (qty ${first.quantity}). How much are you charging for each?`);
          setStep('item_price');
          return;
        }
        const total = calcItemTotal(first);
        const restNote = rest.length > 0 ? `\n\nI also heard ${rest.length} more item${rest.length > 1 ? 's' : ''} in that message — I'll ask you about those next.` : '';
        aiSay(`Here's what I heard:${restNote}`, 'item-card', { ...first, total, pending: true });
        setPendingItem(first);
        setStep('item_confirm');
        break;
      }

      case 'more_items': {
        if (/^\s*(?:y|yes|yeah|yep|sure|ok|okay|add|another|continue)\b/i.test(clean)) {
          moreItemsYes();
        } else if (/^\s*(?:n|no|nope|done|that'?s all|that'?s it|finish|stop|next|that'?s everything)\b/i.test(clean)) {
          moreItemsNo();
        } else {
          // Smart: if it doesn't look like yes/no, treat it as a new item description
          const parsed = parseVoiceInvoice(clean);
          if (parsed.items.length > 0) {
            const item = parsed.items[0];
            if (item.unit_price <= 0) {
              setPendingItem(item);
              aiSay(`Got it — ${item.description} (qty ${item.quantity}). How much for each?`);
              setStep('item_price');
            } else {
              const total = calcItemTotal(item);
              aiSay(`Here's what I heard:`, 'item-card', { ...item, total, pending: true });
              setPendingItem(item);
              setStep('item_confirm');
            }
          } else {
            aiSay("I didn't catch that. Would you like to add another item? Say 'yes', or just describe the item directly.");
          }
        }
        break;
      }

      case 'tax': {
        if (/no\s*tax|tax\s*exempt|no\s*sales\s*tax|zero|0\s*%|skip|none/i.test(clean)) {
          setDraftTax(0);
          aiSay('No tax — got it. Any discount on this invoice?');
          setStep('discount');
        } else {
          const pct = clean.match(/(\d+(?:\.\d+)?)\s*%?/);
          const rate = pct ? parseFloat(pct[1]) : -1;
          if (rate >= 0 && rate <= 100) {
            setDraftTax(rate);
            const sub = draftItems.reduce((s, i) => s + calcItemTotal(i), 0);
            const estTax = Math.round(sub * rate) / 100;
            aiSay(`${rate}% tax — that's about ${formatCurrency(estTax, symbol)} on a ${formatCurrency(sub, symbol)} subtotal. Any discount on this invoice?`);
            setStep('discount');
          } else {
            aiSay("I didn't catch the tax rate. Try something like '8.25%', 'no tax', or 'tax exempt'.");
          }
        }
        break;
      }

      case 'discount': {
        if (/no\s*discount|none|skip|no/i.test(clean)) {
          setDraftDiscount(0);
          aiSay("No discount. Any work-done notes, terms, or warranty info you'd like to add?");
          setStep('notes');
        } else {
          const pctMatch = clean.match(/(\d+(?:\.\d+)?)\s*%/);
          const dollarMatch = clean.match(/\$?\s*(\d[\d,]*\.?\d*)/);
          const sub = draftItems.reduce((s, i) => s + calcItemTotal(i), 0);
          if (pctMatch) {
            const pct = parseFloat(pctMatch[1]);
            const amt = Math.round((sub * pct) / 100 * 100) / 100;
            setDraftDiscount(amt);
            aiSay(`${pct}% discount — that's ${formatCurrency(amt, symbol)} off, bringing the subtotal to ${formatCurrency(sub - amt, symbol)}. Any work-done notes, terms, or warranty info?`);
          } else if (dollarMatch) {
            const amt = parseFloat(dollarMatch[1].replace(/,/g, ''));
            setDraftDiscount(amt);
            aiSay(`${formatCurrency(amt, symbol)} discount, noted — new subtotal ${formatCurrency(sub - amt, symbol)}. Any work-done notes, terms, or warranty info?`);
          } else {
            aiSay("I didn't catch the discount. Try '$50', '10% off', or 'no discount'.");
            return;
          }
          setStep('notes');
        }
        break;
      }

      case 'notes': {
        if (/no\s*notes|none|skip|no\b/i.test(clean)) {
          setDraftNotes(null);
          aiSay('No work-done notes. When should this invoice be due? I default to 30 days — you can say a number of days, "net 15", "due on receipt", or a specific date.');
        } else {
          setDraftNotes(clean);
          aiSay(`Got it — I'll add that to the invoice. When should it be due? I default to 30 days — try "net 15", "due on receipt", "end of month", or a date like "August 15".`);
        }
        setStep('due_date');
        break;
      }

      case 'due_date': {
        let days = 30;
        let label = '';
        if (/receipt|immediately|right\s+away|now|due\s+on\s+receipt|on\s+receipt/i.test(clean)) {
          days = 0; label = 'Due on receipt';
        } else if (/end\s+of\s+month|eom/i.test(clean)) {
          days = 30; label = 'End of month';
        } else if (/next\s+week|a\s+week/i.test(clean)) {
          days = 7; label = '7 days';
        } else if (/two\s+weeks|fortnight/i.test(clean)) {
          days = 14; label = '14 days';
        } else {
          // "net 15", "15 days", "15"
          const netMatch = clean.match(/net\s+(\d+)/i);
          const dayMatch = clean.match(/(\d+)\s*(?:days?|day)?/);
          const source = netMatch || dayMatch;
          if (source) {
            days = parseInt(source[1], 10);
            label = days === 0 ? 'Due on receipt' : `${days} days`;
          }
          // Try a specific date like "August 15" or "8/15"
          const dateMatch = clean.match(/(\d{1,2})[\/-](\d{1,2})/);
          if (dateMatch) {
            const target = new Date(new Date().getFullYear(), parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
            const diff = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diff >= 0 && diff <= 365) {
              days = diff; label = formatDate(target.toISOString());
            }
          }
        }
        setDraftDueDays(days);
        showReview();
        break;
      }

      default:
        break;
    }
  }, [step, clients, pendingItem, draftItems, symbol, userSay, aiSay]); // eslint-disable-line

  // ---- Show full review ----
  const showReview = useCallback(() => {
    setStep('review');
    const items: InvoiceItem[] = draftItems.map((it, i) => ({
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: calcItemTotal(it),
      sort_order: i,
      item_type: 'service',
      unit: 'ea',
      tax_rate: null,
      discount_amount: 0,
      notes: null,
    }));
    const taxRate = draftTax ?? 0;
    const discount = draftDiscount ?? 0;
    const totals = recalcInvoice(items, taxRate, discount);
    aiSay(
      `Here's everything I've collected. Please review it carefully before I finalize the invoice:`,
      'review-card',
      {
        clientName: draftClient,
        items,
        taxRate,
        discount,
        notes: draftNotes || '',
        dueDays: draftDueDays,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        total: totals.total,
        symbol,
      } as ReviewCardData,
    );
  }, [draftItems, draftTax, draftDiscount, draftNotes, draftClient, draftDueDays, symbol, aiSay]);

  // ---- Confirm item (Yes / Edit / No) ----
  const confirmItemYes = useCallback(() => {
    if (!pendingItem) return;
    setDraftItems(prev => [...prev, pendingItem]);
    const newCount = draftItems.length + 1;
    const newTotal = draftItems.reduce((s, i) => s + calcItemTotal(i), 0) + calcItemTotal(pendingItem);
    setPendingItem(null);
    aiSay(`Added! That's ${newCount} item${newCount > 1 ? 's' : ''} so far, totaling ${formatCurrency(newTotal, symbol)}. Would you like to add another item?`);
    setStep('more_items');
  }, [pendingItem, draftItems, symbol, aiSay]);

  const confirmItemEdit = useCallback(() => {
    setPendingItem(null);
    aiSay('No problem — tell me the item again. Include the description, quantity, and price, like "5 hours of consulting at $150".');
    setStep('item');
  }, [aiSay]);

  const confirmItemNo = useCallback(() => {
    setPendingItem(null);
    aiSay('OK, I skipped that one. Would you like to add a different item?');
    setStep('more_items');
  }, [aiSay]);

  // ---- Confirm client (Yes / Edit) ----
  const confirmClientYes = useCallback(() => {
    const count = draftItems.length;
    const followUp = count === 0
      ? "Now tell me about the first thing you're billing for. Include the description, quantity, and price — for example: '10 hours of development at $120' or '3 design mockups at $400 each'."
      : `I've already got ${count} item${count > 1 ? 's' : ''} queued up. Tell me about the next item — description, quantity, and price.`;
    aiSay(`Great, ${draftClient} is locked in. ${followUp}`);
    setStep('item');
  }, [draftClient, draftItems, aiSay]);

  const confirmClientEdit = useCallback(() => {
    setDraftClient('');
    setDraftClientId(null);
    aiSay('Sure — who should I bill this invoice to?');
    setStep('client');
  }, [aiSay]);

  // ---- More items (Yes / No) ----
  const moreItemsYes = useCallback(() => {
    aiSay("What's the next item? Tell me the description, quantity, and price.");
    setStep('item');
  }, [aiSay]);

  const moreItemsNo = useCallback(() => {
    const count = draftItems.length;
    const total = draftItems.reduce((s, i) => s + calcItemTotal(i), 0);
    aiSay(`Perfect — ${count} item${count > 1 ? 's' : ''} totaling ${formatCurrency(total, symbol)}. Next, what tax rate should I apply? You can say a percentage like "8.25%" or "no tax".`);
    setStep('tax');
  }, [draftItems, symbol, aiSay]);

  // ---- Inline edits: pending item + review items ----
  const updatePendingItem = useCallback((item: DraftItem) => {
    setPendingItem(item);
  }, []);

  const updateReviewItems = useCallback((items: DraftItem[]) => {
    setDraftItems(items);
  }, []);

  // ---- Review: edit specific section ----
  const editFromReview = useCallback((section: 'client' | 'items' | 'tax' | 'notes') => {
    if (section === 'client') {
      aiSay("Sure, let's update the client. Who should I bill this to?");
      setStep('client');
    } else if (section === 'items') {
      aiSay("Let's update the items. Tell me the item you want to add or change.");
      setStep('item');
    } else if (section === 'tax') {
      aiSay('What tax rate should I apply?');
      setStep('tax');
    } else if (section === 'notes') {
      aiSay('What work-done notes or terms would you like?');
      setStep('notes');
    }
  }, [aiSay]);

  // ---- Finalize: create the invoice ----
  const finalize = useCallback(async () => {
    setStep('finalizing');
    setSaving(true);

    let clientId: string | null = draftClientId;
    if (draftClient && !clientId) {
      const existing = clients.find(c => c.name.toLowerCase() === draftClient.toLowerCase());
      if (existing) {
        clientId = existing.id;
      } else {
        const newClient = await createClient({ name: draftClient, email: null, phone: null, address: null, company: null, notes: null, tax_id: null });
        if (newClient) clientId = newClient.id;
      }
    }

    const items: InvoiceItem[] = draftItems.map((it, i) => ({
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: calcItemTotal(it),
      sort_order: i,
      item_type: 'service',
      unit: 'ea',
      tax_rate: null,
      discount_amount: 0,
      notes: null,
    }));

    const taxRate = draftTax ?? 0;
    const discount = draftDiscount ?? 0;
    const totals = recalcInvoice(items, taxRate, discount);
    const invoiceNumber = generateInvoiceNumber(profile?.invoice_prefix || 'INV', profile?.next_invoice_number || 1);

    const result = await createInvoice({
      invoice_number: invoiceNumber,
      estimate_number: null,
      client_id: clientId,
      client_name: draftClient || null,
      client_email: null,
      client_phone: null,
      client_address: null,
      work_order_number: null,
      technician_name: null,
      status: 'draft',
      issue_date: todayISO(),
      due_date: draftDueDays > 0 ? addDays(todayISO(), draftDueDays) : todayISO(),
      subtotal: totals.subtotal,
      tax_rate: taxRate,
      tax_amount: totals.taxAmount,
      discount_amount: discount,
      fees_amount: 0,
      shipping_amount: 0,
      deposit_amount: 0,
      total: totals.total,
      notes: draftNotes || null,
      terms: 'Payment due within 30 days of issue.',
      warranty: null,
      metadata: {},
      industry_template: 'general' as const,
      document_type: 'invoice' as const,
      recurring_enabled: false,
      recurring_interval: null,
      stripe_payment_intent_id: null,
      stripe_checkout_session_id: null,
      payment_status: 'unpaid' as const,
      hearth_status: null,
      hearth_application_url: null,
      parent_invoice_id: null,
      recurring_next_date: null,
      converted_at: null,
    }, items);

    if (result && profile) {
      await supabase
        .from('business_profile')
        .update({ next_invoice_number: (profile.next_invoice_number || 1) + 1 })
        .eq('id', profile.id);

      setSaving(false);
      setStep('done');
      aiSay(`Your invoice is ready!`, 'success', {
        invoiceNumber,
        total: totals.total,
        symbol,
      } as SuccessCardData);

      setTimeout(() => onNavigate({ name: 'preview', invoiceId: result.id }), 3000);
    } else {
      setSaving(false);
      setStep('review');
      aiSay('Something went wrong while creating the invoice. Please try again — tap "Create Invoice" in the review above.');
    }
  }, [draftClient, draftClientId, draftItems, draftTax, draftDiscount, draftNotes, draftDueDays, clients, createClient, createInvoice, profile, symbol, aiSay, onNavigate]);

  // ---- Send handler ----
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || aiTyping) return;
    processInput(text);
  }, [input, aiTyping, processInput]);

  const handleSuggestion = useCallback((suggestion: string) => {
    if (aiTyping) return;
    processInput(suggestion);
  }, [aiTyping, processInput]);

  // ---- Running total ----
  const runningTotal = useMemo(() => {
    return draftItems.reduce((s, i) => s + calcItemTotal(i), 0);
  }, [draftItems]);

  // ---- Track which item-card message is the active editable one ----
  const lastItemCardId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type === 'item-card') return messages[i].id;
    }
    return null;
  }, [messages]);

  // ---- Step labels for progress ----
  const stepLabels = ['Client', 'Items', 'Tax', 'Discount', 'Work Done', 'Review'];
  const currentStepIndex = useMemo(() => {
    if (step === 'greeting' || step === 'client' || step === 'client_confirm') return 0;
    if (step === 'item' || step === 'item_price' || step === 'item_confirm' || step === 'more_items') return 1;
    if (step === 'tax') return 2;
    if (step === 'discount') return 3;
    if (step === 'notes' || step === 'due_date') return 4;
    if (step === 'review' || step === 'finalizing' || step === 'done') return 5;
    return 0;
  }, [step]);

  // ---- Not supported fallback ----
  if (!supported && messages.length === 0) {
    aiSay("Welcome! I'm your invoice assistant. Voice input isn't available in your browser, but you can type everything. Who is this invoice for?");
    setStep('client');
  }

  // ============================ RENDER ============================
  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => onNavigate({ name: 'dashboard' })} className="btn-ghost px-2.5">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${accent}15` }}>
                <Bot className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  Invoice Assistant
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: accent }}>
                    AI
                  </span>
                </h1>
                <p className="text-xs text-slate-400">Step-by-step guided invoicing</p>
              </div>
            </div>
          </div>

          {/* Running summary */}
          {draftItems.length > 0 && (
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5 text-slate-500">
                <ClipboardList className="w-4 h-4" />
                <span className="font-medium">{draftItems.length} item{draftItems.length > 1 ? 's' : ''}</span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <span className="font-bold text-slate-900">{formatCurrency(runningTotal, symbol)}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="max-w-3xl mx-auto mt-3 flex items-center gap-1">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex-1 flex items-center gap-1">
              <div
                className="h-1 flex-1 rounded-full transition-all duration-500"
                style={{
                  background: i <= currentStepIndex ? accent : 'rgb(226 232 240)',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 py-6 space-y-4">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              accent={accent}
              symbol={symbol}
              pendingItem={pendingItem}
              isActiveItem={msg.id === lastItemCardId}
              onUpdatePendingItem={updatePendingItem}
              onConfirmItemYes={confirmItemYes}
              onConfirmItemEdit={confirmItemEdit}
              onConfirmItemNo={confirmItemNo}
              onConfirmClientYes={confirmClientYes}
              onConfirmClientEdit={confirmClientEdit}
              onMoreItemsYes={moreItemsYes}
              onMoreItemsNo={moreItemsNo}
              onEditFromReview={editFromReview}
              onReviewItemsChange={updateReviewItems}
              onFinalize={finalize}
              saving={saving}
              step={step}
            />
          ))}

          {/* Typing indicator */}
          {aiTyping && (
            <div className="flex items-start gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15` }}>
                <Bot className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: accent, animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: accent, animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: accent, animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Suggestion chips */}
      {suggestions.length > 0 && !aiTyping && step !== 'finalizing' && step !== 'done' && (
        <div className="flex-shrink-0 px-4 lg:px-6 pb-2">
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 active:scale-95"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      {step !== 'finalizing' && step !== 'done' && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-4 lg:px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            {supported && (
              <button
                onClick={toggleMic}
                className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  listening
                    ? 'bg-red-50 text-red-500 scale-105'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
              placeholder={
                listening ? 'Listening...' :
                step === 'client' || step === 'greeting' ? 'Type or speak the client name...' :
                step === 'item' || step === 'item_price' ? 'Describe an item — e.g. "5 hours at $150"...' :
                'Type your answer...'
              }
              disabled={aiTyping || listening}
              className="flex-1 input !rounded-xl"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || aiTyping || listening}
              className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all duration-200 active:scale-95 disabled:opacity-40"
              style={{ background: accent }}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================ MESSAGE BUBBLE ============================

interface MessageBubbleProps {
  msg: ChatMessage;
  accent: string;
  symbol: string;
  pendingItem: DraftItem | null;
  isActiveItem: boolean;
  onUpdatePendingItem: (item: DraftItem) => void;
  onConfirmItemYes: () => void;
  onConfirmItemEdit: () => void;
  onConfirmItemNo: () => void;
  onConfirmClientYes: () => void;
  onConfirmClientEdit: () => void;
  onMoreItemsYes: () => void;
  onMoreItemsNo: () => void;
  onEditFromReview: (section: 'client' | 'items' | 'tax' | 'notes') => void;
  onReviewItemsChange: (items: DraftItem[]) => void;
  onFinalize: () => void;
  saving: boolean;
  step: Step;
}

function MessageBubble({
  msg, accent, symbol,
  pendingItem, isActiveItem, onUpdatePendingItem,
  onConfirmItemYes, onConfirmItemEdit, onConfirmItemNo,
  onConfirmClientYes, onConfirmClientEdit,
  onMoreItemsYes, onMoreItemsNo,
  onEditFromReview, onReviewItemsChange, onFinalize, saving, step,
}: MessageBubbleProps) {
  const isAI = msg.role === 'ai';

  if (!isAI) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[80%] bg-white rounded-2xl rounded-tr-sm border border-slate-200 px-4 py-3 shadow-sm">
          <p className="text-sm text-slate-700 leading-relaxed">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      {/* AI Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${accent}15` }}>
        <Bot className="w-4 h-4" style={{ color: accent }} />
      </div>

      <div className="flex-1 min-w-0">
        {msg.type === 'text' && (
          <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 px-4 py-3 shadow-sm inline-block max-w-full">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{msg.content}</p>
          </div>
        )}

        {msg.type === 'client-card' && msg.data && (
          <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm overflow-hidden max-w-md">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm text-slate-700 leading-relaxed mb-2">{msg.content}</p>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}15` }}>
                  <Sparkles className="w-4 h-4" style={{ color: accent }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{(msg.data as any).name}</p>
                  {(msg.data as any).email && <p className="text-xs text-slate-400 truncate">{(msg.data as any).email}</p>}
                </div>
              </div>
            </div>
            {step === 'client_confirm' && (
              <div className="flex gap-2 p-3">
                <button onClick={onConfirmClientYes} className="btn-primary flex-1 !py-2 text-xs" style={{ background: accent }}>
                  <Check className="w-3.5 h-3.5" /> Yes, correct
                </button>
                <button onClick={onConfirmClientEdit} className="btn-secondary flex-1 !py-2 text-xs">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              </div>
            )}
          </div>
        )}

        {msg.type === 'item-card' && msg.data && (
          step === 'item_confirm' && isActiveItem && pendingItem ? (
            <EditableItemCard
              item={pendingItem}
              accent={accent}
              symbol={symbol}
              onUpdate={onUpdatePendingItem}
              onConfirmYes={onConfirmItemYes}
              onConfirmRedo={onConfirmItemEdit}
              onConfirmNo={onConfirmItemNo}
            />
          ) : (
            <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm overflow-hidden max-w-md">
              <div className="px-4 py-3">
                <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Description</span>
                    <span className="text-sm font-medium text-slate-900">{(msg.data as ItemCardData).description}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Quantity</span>
                    <span className="text-sm font-medium text-slate-900">{(msg.data as ItemCardData).quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">Unit Price</span>
                    <span className="text-sm font-medium text-slate-900">{formatCurrency((msg.data as ItemCardData).unit_price, symbol)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-xs font-semibold text-slate-500">Line Total</span>
                    <span className="text-base font-bold" style={{ color: accent }}>
                      {formatCurrency((msg.data as ItemCardData).total, symbol)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {msg.type === 'review-card' && msg.data && (
          <ReviewCard
            data={msg.data as ReviewCardData}
            accent={accent}
            onEditFromReview={onEditFromReview}
            onReviewItemsChange={onReviewItemsChange}
            onFinalize={onFinalize}
            saving={saving}
            step={step}
          />
        )}

        {msg.type === 'success' && msg.data && (
          <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm overflow-hidden max-w-md animate-scale-in">
            <div className="px-5 py-5 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: `${accent}15` }}>
                <Check className="w-7 h-7" style={{ color: accent }} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Invoice Created!</h3>
              <p className="text-sm text-slate-500 mb-3">
                {(msg.data as SuccessCardData).invoiceNumber} — {formatCurrency((msg.data as SuccessCardData).total, (msg.data as SuccessCardData).symbol)}
              </p>
              <p className="text-xs text-slate-400">Opening your invoice preview...</p>
              <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2 text-slate-300" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================ EDITABLE ITEM CARD ============================

function EditableItemCard({
  item, accent, symbol, onUpdate, onConfirmYes, onConfirmRedo, onConfirmNo,
}: {
  item: DraftItem;
  accent: string;
  symbol: string;
  onUpdate: (item: DraftItem) => void;
  onConfirmYes: () => void;
  onConfirmRedo: () => void;
  onConfirmNo: () => void;
}) {
  const total = calcItemTotal(item);
  const canAdd = item.description.trim().length > 0 && item.quantity > 0 && item.unit_price > 0;
  const inputCls = 'w-full text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none transition-colors';
  return (
    <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm overflow-hidden max-w-md">
      <div className="px-4 py-3 border-b border-slate-100">
        <p className="text-sm text-slate-700 leading-relaxed mb-3">Here's what I've got — tap any field to edit it:</p>
        <div className="bg-slate-50 rounded-xl p-3 space-y-3">
          <div>
            <label className="text-xs text-slate-400">Description</label>
            <input
              type="text"
              value={item.description}
              onChange={e => onUpdate({ ...item, description: e.target.value })}
              className={inputCls + ' mt-1'}
              placeholder="What is this item?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400">Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                value={item.quantity === 0 ? '' : item.quantity}
                onChange={e => onUpdate({ ...item, quantity: parseFloat(e.target.value) || 0 })}
                className={inputCls + ' mt-1'}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Unit Price</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">{symbol}</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.unit_price === 0 ? '' : item.unit_price}
                  onChange={e => onUpdate({ ...item, unit_price: parseFloat(e.target.value) || 0 })}
                  className={inputCls + ' pl-7'}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Line Total</span>
            <span className="text-base font-bold" style={{ color: accent }}>{formatCurrency(total, symbol)}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 p-3">
        <button onClick={onConfirmYes} disabled={!canAdd} className="btn-primary flex-1 !py-2 text-xs disabled:opacity-40" style={{ background: accent }}>
          <Check className="w-3.5 h-3.5" /> Add it
        </button>
        <button onClick={onConfirmRedo} className="btn-secondary !py-2 text-xs" title="Re-enter by voice/text">
          <RotateCcw className="w-3.5 h-3.5" /> Redo
        </button>
        <button onClick={onConfirmNo} className="btn-secondary !py-2 text-xs text-red-500 hover:bg-red-50" title="Skip this item">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================ REVIEW CARD ============================

function ReviewCard({
  data, accent, onEditFromReview, onReviewItemsChange, onFinalize, saving, step,
}: {
  data: ReviewCardData;
  accent: string;
  onEditFromReview: (section: 'client' | 'items' | 'tax' | 'notes') => void;
  onReviewItemsChange: (items: DraftItem[]) => void;
  onFinalize: () => void;
  saving: boolean;
  step: Step;
}) {
  const [items, setItems] = useState<DraftItem[]>(() =>
    data.items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price }))
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const subtotal = items.reduce((s, i) => s + calcItemTotal(i), 0);
  const taxAmount = Math.round(subtotal * data.taxRate) / 100;
  const total = Math.max(0, subtotal + taxAmount - data.discount);

  const commit = (next: DraftItem[]) => {
    setItems(next);
    onReviewItemsChange(next);
  };
  const updateField = (idx: number, field: keyof DraftItem, value: string | number) => {
    commit(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const deleteItem = (idx: number) => {
    commit(items.filter((_, i) => i !== idx));
    setEditingIndex(null);
  };

  const inputCls = 'w-full text-sm font-medium text-slate-900 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none transition-colors';

  return (
    <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm overflow-hidden max-w-lg">
      <p className="text-sm text-slate-700 leading-relaxed px-4 pt-4 pb-3">{`Here's everything I've collected. Please review it carefully before I finalize the invoice:`}</p>

      <div className="px-4 pb-4 space-y-3">
        {/* Client section */}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Bill To</span>
            <button onClick={() => onEditFromReview('client')} className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          </div>
          <p className="text-sm font-semibold text-slate-900">{data.clientName || '— no client —'}</p>
        </div>

        {/* Items section */}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Line Items ({items.length})</span>
            <button onClick={() => onEditFromReview('items')} className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add item
            </button>
          </div>
          <div className="space-y-1.5">
            {items.length === 0 && (
              <p className="text-xs text-slate-400 italic py-2 text-center">No items yet — tap "Add item" to include one.</p>
            )}
            {items.map((item, i) => (
              <div key={i}>
                {editingIndex === i ? (
                  <div className="bg-white rounded-lg p-2.5 space-y-2 border border-slate-200">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateField(i, 'description', e.target.value)}
                      className={inputCls}
                      placeholder="Description"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400">Qty</span>
                        <input
                          type="number" min="0" step="any"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={e => updateField(i, 'quantity', parseFloat(e.target.value) || 0)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Unit price</span>
                        <input
                          type="number" min="0" step="any"
                          value={item.unit_price === 0 ? '' : item.unit_price}
                          onChange={e => updateField(i, 'unit_price', parseFloat(e.target.value) || 0)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Line total: <span className="font-semibold text-slate-700">{formatCurrency(calcItemTotal(item), data.symbol)}</span></span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => deleteItem(i)} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                        <button onClick={() => setEditingIndex(null)} className="text-xs font-medium text-white px-2.5 py-1 rounded-md" style={{ background: accent }}>
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between text-sm group">
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-700">{item.description}</span>
                      <span className="text-xs text-slate-400 ml-1.5">×{item.quantity} @ {formatCurrency(item.unit_price, data.symbol)}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-slate-600 font-medium">{formatCurrency(calcItemTotal(item), data.symbol)}</span>
                      <button onClick={() => setEditingIndex(i)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 transition-opacity">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteItem(i)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-900">{formatCurrency(subtotal, data.symbol)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Tax ({data.taxRate}%)</span>
            <span className="font-medium text-slate-900">{formatCurrency(taxAmount, data.symbol)}</span>
          </div>
          {data.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Discount</span>
              <span className="font-medium text-red-500">−{formatCurrency(data.discount, data.symbol)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-900">Total</span>
            <span className="text-xl font-bold" style={{ color: accent }}>{formatCurrency(total, data.symbol)}</span>
          </div>
        </div>

        {/* Due date */}
        <div className="bg-slate-50 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Due Date</span>
          </div>
          <p className="text-sm text-slate-700">
            {data.dueDays === 0 ? 'Due on receipt' : `${data.dueDays} days from issue (${formatDate(addDays(todayISO(), data.dueDays))})`}
          </p>
        </div>

        {/* Work Done */}
        {data.notes && (
          <div className="bg-slate-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Work Done</span>
              <button onClick={() => onEditFromReview('notes')} className="text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            </div>
            <p className="text-sm text-slate-700">{data.notes}</p>
          </div>
        )}

        {/* Finalize button */}
        {step === 'review' && (
          <button
            onClick={onFinalize}
            disabled={saving || items.length === 0}
            className="btn-primary w-full !py-3 mt-2 disabled:opacity-40"
            style={{ background: accent }}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating invoice...</>
            ) : (
              <><FileText className="w-4 h-4" /> Looks good — create invoice</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
