import type { ParsedVoiceInvoice, ParsedVoiceItem } from './types';

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
  fifty: 50, hundred: 100, thousand: 1000,
};

function parseNumber(text: string): number | null {
  const cleaned = text.trim().toLowerCase();

  // Direct numeric
  const numericMatch = cleaned.match(/(\d[\d,]*\.?\d*)/);
  if (numericMatch) {
    return parseFloat(numericMatch[1].replace(/,/g, ''));
  }

  // Word numbers (simple)
  if (NUMBER_WORDS[cleaned] !== undefined) return NUMBER_WORDS[cleaned];

  return null;
}

function extractAmount(text: string): number | null {
  // Match "$50", "50 dollars", "50 bucks", "at 50", "for 50"
  const dollarMatch = text.match(/\$\s*(\d[\d,]*\.?\d*)/);
  if (dollarMatch) return parseFloat(dollarMatch[1].replace(/,/g, ''));

  const dollarWordMatch = text.match(/(\d[\d,]*\.?\d*)\s*(?:dollars?|bucks?)/);
  if (dollarWordMatch) return parseFloat(dollarWordMatch[1].replace(/,/g, ''));

  const atMatch = text.match(/(?:at|for|@)\s*(\d[\d,]*\.?\d*)/);
  if (atMatch) return parseFloat(atMatch[1].replace(/,/g, ''));

  // "fifty dollars" word-based
  const wordDollarMatch = text.match(/(\w+)\s*(?:dollars?|bucks?)/);
  if (wordDollarMatch) {
    const n = parseNumber(wordDollarMatch[1]);
    if (n !== null) return n;
  }

  return null;
}

function extractQuantity(text: string): number {
  // "3 hours of", "2x", "x2", "5 units of"
  const qtyMatch = text.match(/(\d+)\s*(?:hours?|hrs?|units?|items?|days?|x\s)/i);
  if (qtyMatch) return parseFloat(qtyMatch[1]);

  const xMatch = text.match(/(?:^|\s)(\d+)\s*x/i) || text.match(/\bx\s*(\d+)/i);
  if (xMatch) return parseFloat(xMatch[1]);

  // "for 3 hours" pattern
  const forMatch = text.match(/(\d+)\s*(?:hours?|hrs?)/i);
  if (forMatch) return parseFloat(forMatch[1]);

  return 1;
}

function cleanDescription(text: string): string {
  let cleaned = text;
  // Remove price-related phrases
  cleaned = cleaned.replace(/\$\s*\d[\d,]*\.?\d*/g, '');
  cleaned = cleaned.replace(/\b\d[\d,]*\.?\d*\s*(?:dollars?|bucks?)/gi, '');
  cleaned = cleaned.replace(/\bat\s+\d[\d,]*\.?\d*/gi, '');
  cleaned = cleaned.replace(/\bfor\s+\d[\d,]*\.?\d*\s*(?:dollars?|bucks?)?/gi, '');
  // Remove quantity markers
  cleaned = cleaned.replace(/\b\d+\s*(?:hours?|hrs?|units?|items?|days?)\s+of\b/gi, '');
  cleaned = cleaned.replace(/\b\d+\s*x\b/gi, '');
  cleaned = cleaned.replace(/\bx\s*\d+/gi, '');
  // Clean up
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/^(?:and|also|plus|then)\s+/i, '');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function parseVoiceInvoice(transcript: string): ParsedVoiceInvoice {
  const result: ParsedVoiceInvoice = {
    clientName: null,
    clientPhone: null,
    clientEmail: null,
    clientAddress: null,
    invoiceNumber: null,
    invoiceDate: null,
    workOrderNumber: null,
    technicianName: null,
    items: [],
    subtotal: null,
    taxRate: null,
    taxAmount: null,
    discount: null,
    fees: null,
    total: null,
    dueDate: null,
    terms: null,
    notes: null,
    warranty: null,
  };

  if (!transcript.trim()) return result;

  const lower = transcript.toLowerCase();

  // Extract client name: "for [Name]", "bill [Name]", "invoice [Name]"
  const clientPatterns = [
    /(?:invoice|bill|for|to|from)\s+([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  /client\s+(?:is\s+|name(?:d)?\s+)?([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  /customer\s+(?:is\s+|name(?:d)?\s+)?([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  /billed?\s+(?:to\s+)?([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  /(?:for|to)\s+([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  /^([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  /^([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  /^([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
    /^([a-z][a-z\s]+?)(?:\s+(?:for|with|add|include|tax|discount|note)|,|\.|$)/i,
  ];

  for (const pattern of clientPatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common false positives
      if (name.length > 1 && !['a', 'an', 'the', 'me', 'my', 'us', 'we'].includes(name.toLowerCase())) {
        result.clientName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }
  }

  // Extract tax rate: "tax 8%", "8% tax", "tax rate 8.5"
  const taxMatch = lower.match(/(?:tax(?:\s+rate)?\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:tax)?/) 
    || lower.match(/tax(?:\s+rate)?\s+(?:is\s+)?(\d+(?:\.\d+)?)/)
    || lower.match(/(\d+(?:\.\d+)?)\s*percent\s+tax/);
  if (taxMatch) {
    result.taxRate = parseFloat(taxMatch[1]);
  }

  // Extract discount: "discount $50", "$50 discount", "discount 50"
  const discountMatch = lower.match(/discount\s+(?:of\s+)?\$?\s*(\d[\d,]*\.?\d*)/)
    || lower.match(/\$?\s*(\d[\d,]*\.?\d*)\s+discount/);
  if (discountMatch) {
    result.discount = parseFloat(discountMatch[1].replace(/,/g, ''));
  }

  // Extract notes: "note: ...", "notes: ..."
  const notesMatch = transcript.match(/(?:note|notes)\s*:\s*(.+?)(?:$)/i);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  }

  // Extract line items
  // Split on "add", "also", "plus", "item", "line item", commas, "and"
  let workingText = transcript;

  // Remove the client phrase so it doesn't get parsed as an item
  if (result.clientName) {
    workingText = workingText.replace(new RegExp(`(?:invoice|bill|for|to|from|client|customer|billed?)\\s+(?:to\\s+)?${escapeRegex(result.clientName)}`, 'i'), '');
  }

  // Remove tax, discount, notes phrases
  workingText = workingText.replace(/(?:tax(?:\s+rate)?\s+)?\d+(?:\.\d+)?\s*%\s*(?:tax)?/gi, '');
  workingText = workingText.replace(/tax(?:\s+rate)?\s+(?:is\s+)?\d+(?:\.\d+)?/gi, '');
  workingText = workingText.replace(/\d+(?:\.\d+)?\s*percent\s+tax/gi, '');
  workingText = workingText.replace(/discount\s+(?:of\s+)?\$?\s*\d[\d,]*\.?\d*/gi, '');
  workingText = workingText.replace(/\$?\s*\d[\d,]*\.?\d*\s+discount/gi, '');
  workingText = workingText.replace(/(?:note|notes)\s*:\s*.+/gi, '');

  // Split into item phrases
  const itemDelimiters = /\s+(?:add|also|plus|then|item|line item|include|including|next)\s+/gi;
  let parts = workingText.split(itemDelimiters);

  // Also split on commas if they seem to separate items (have prices)
  const expandedParts: string[] = [];
  for (const part of parts) {
    const commaParts = part.split(/,\s*(?=[a-z])/i);
    for (const cp of commaParts) {
      if (cp.trim()) expandedParts.push(cp.trim());
    }
  }
  parts = expandedParts;

  for (const part of parts) {
    const trimmed = part.trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
    if (!trimmed) continue;

    const amount = extractAmount(trimmed);
    const quantity = extractQuantity(trimmed);
    const description = cleanDescription(trimmed);

    if (!description) continue;

    const item: ParsedVoiceItem = {
      description,
      quantity,
      unit_price: amount !== null ? amount : 0,
    };

    result.items.push(item);
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateInvoiceNumber(prefix: string, nextNumber: number): string {
  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}
