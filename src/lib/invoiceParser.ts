import type { ParsedVoiceInvoice } from './types';

function toTitleCase(s: string): string {
  return s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ').trim();
}

function parseMoney(text: string): number | null {
  const m = text.match(/\$?\s*(\d[\d,]*\.?\d*)/);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ''));
}

function parsePercent(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  return parseFloat(m[1]);
}

function normalizeDate(text: string): string | null {
  if (!text) return null;
  const t = text.trim();
  // Already ISO
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // MM/DD/YYYY or M/D/YYYY
  const us = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  }
  // MM-DD-YYYY
  const usDash = t.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (usDash) {
    return `${usDash[3]}-${usDash[1].padStart(2, '0')}-${usDash[2].padStart(2, '0')}`;
  }
  // "July 31, 2026" or "Jul 31 2026"
  const months: Record<string, string> = {
    january: '01', jan: '01', february: '02', feb: '02', march: '03', mar: '03',
    april: '04', apr: '04', may: '05', june: '06', jun: '06', july: '07', jul: '07',
    august: '08', aug: '08', september: '09', sep: '09', sept: '09', october: '10', oct: '10',
    november: '11', nov: '11', december: '12', dec: '12',
  };
  const long = t.match(/(?:^|[^\d])([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (long) {
    const mo = months[long[1].toLowerCase()];
    if (mo) return `${long[3]}-${mo}-${long[2].padStart(2, '0')}`;
  }
  // "31 July 2026"
  const dmy = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s+(\d{4})/i);
  if (dmy) {
    const mo = months[dmy[2].toLowerCase()];
    if (mo) return `${dmy[3]}-${mo}-${dmy[1].padStart(2, '0')}`;
  }
  return null;
}

function extractAfterLabel(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:#]?\\s*(.+?)(?:\\n|$)`, 'i');
    const m = text.match(re);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

function extractPhone(text: string): string | null {
  const m = text.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (!m) return null;
  const raw = m[1].replace(/[^\d]/g, '');
  if (raw.length !== 10) return null;
  return `(${raw.slice(0,3)}) ${raw.slice(3,6)}-${raw.slice(6)}`;
}

function extractEmail(text: string): string | null {
  const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return m ? m[0] : null;
}

function extractAddress(text: string): string | null {
  const lines = text.split('\n');
  // Look for a line with street number
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+\s+[A-Za-z]/.test(trimmed) && /,\s*[A-Z]{2}/.test(trimmed)) {
      return trimmed;
    }
  }
  // Try multiline address block
  const streetLine = lines.find(l => /^\d+\s+[A-Za-z]/.test(l.trim()));
  if (streetLine) {
    const idx = lines.indexOf(streetLine);
    const block = lines.slice(idx, idx + 3).join(', ').trim();
    if (block.length > 10) return block;
  }
  return null;
}

export function parseInvoiceText(rawText: string): ParsedVoiceInvoice {
  const text = rawText.trim();
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

  if (!text) return result;

  // Invoice number
  result.invoiceNumber = extractAfterLabel(text, [
    'invoice\\s*(?:no|number|#)', 'inv\\.?\\s*(?:no|number|#)',
    'invoice', 'bill\\s*(?:no|number|#)',
  ]);
  if (result.invoiceNumber) {
    result.invoiceNumber = result.invoiceNumber.replace(/\s+/g, ' ').trim();
  }

  // Work order number
  result.workOrderNumber = extractAfterLabel(text, [
    'work\\s*order\\s*(?:no|number|#)?', 'w\\.?o\\.?\\s*(?:no|number|#)?',
    'job\\s*(?:no|number|#)?', 'service\\s*order\\s*(?:no|number|#)?',
  ]);

  // Technician / service person
  result.technicianName = extractAfterLabel(text, [
    'technician', 'tech\\.?', 'service\\s*person', 'serviced\\s*by',
    'repair\\s*by', 'assigned\\s*to', 'performed\\s*by',
  ]);

  // Dates
  const invoiceDateRaw = extractAfterLabel(text, [
    'invoice\\s*date', 'date\\s*of\\s*invoice', 'issue\\s*date', 'date\\s*issued',
    'date', 'billed\\s*on',
  ]);
  if (invoiceDateRaw) result.invoiceDate = normalizeDate(invoiceDateRaw);

  const dueDateRaw = extractAfterLabel(text, [
    'due\\s*date', 'payment\\s*due', 'due\\s*by', 'pay\\s*by',
  ]);
  if (dueDateRaw) result.dueDate = normalizeDate(dueDateRaw);

  // Customer section
  result.clientName = extractAfterLabel(text, [
    'bill\\s*to', 'billed\\s*to', 'customer(?:\\s*name)?', 'client(?:\\s*name)?',
    'name', 'sold\\s*to', 'ship\\s*to',
  ]);
  if (result.clientName) {
    // Stop at known keywords
    result.clientName = result.clientName
      .replace(/\s+(?:address|phone|email|invoice|job|work|date|line|item|qty|quantity|description|subtotal|tax|total|due|notes?|warranty)\b.*$/i, '')
      .trim();
    result.clientName = toTitleCase(result.clientName);
  }

  result.clientPhone = extractAfterLabel(text, ['phone', 'tel\\.?', 'telephone', 'mobile', 'cell'])
    || extractPhone(text);
  if (result.clientPhone && !/^\(\d{3}\)\s\d{3}-\d{4}$/.test(result.clientPhone)) {
    const p = extractPhone(result.clientPhone);
    if (p) result.clientPhone = p;
  }

  result.clientEmail = extractAfterLabel(text, ['email', 'e-mail', 'email\\s*address'])
    || extractEmail(text);
  if (result.clientEmail) {
    const e = extractEmail(result.clientEmail);
    if (e) result.clientEmail = e;
  }

  result.clientAddress = extractAfterLabel(text, ['address', 'service\\s*address', 'site\\s*address', 'location']);
  if (!result.clientAddress) result.clientAddress = extractAddress(text);
  if (result.clientAddress) {
    result.clientAddress = result.clientAddress
      .replace(/\s+(?:phone|email|invoice|job|work|date|line|item|qty|quantity|description|subtotal|tax|total|due|notes?|warranty)\b.*$/i, '')
      .trim();
  }

  // Totals
  const subtotalRaw = extractAfterLabel(text, ['subtotal', 'sub\\s*total', 'sub-total']);
  if (subtotalRaw) result.subtotal = parseMoney(subtotalRaw);

  const taxRateRaw = extractAfterLabel(text, ['tax\\s*rate', 'sales\\s*tax\\s*rate']);
  if (taxRateRaw) {
    result.taxRate = parsePercent(taxRateRaw) || parseMoney(taxRateRaw);
  }
  const taxAmountRaw = extractAfterLabel(text, ['tax\\s*amount', 'tax', 'sales\\s*tax']);
  if (taxAmountRaw) result.taxAmount = parseMoney(taxAmountRaw);
  if (result.taxRate === null) {
    const pct = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:tax|sales\s*tax)?/i);
    if (pct) result.taxRate = parseFloat(pct[1]);
  }

  const totalRaw = extractAfterLabel(text, [
    'total\\s*due', 'grand\\s*total', 'total', 'balance\\s*due', 'amount\\s*due',
    'final\\s*total',
  ]);
  if (totalRaw) result.total = parseMoney(totalRaw);

  const discountRaw = extractAfterLabel(text, ['discount', 'deduction', 'discount\\s*amount']);
  if (discountRaw) result.discount = parseMoney(discountRaw);

  const feesRaw = extractAfterLabel(text, ['fees?', 'service\\s*fee', 'shipping', 'delivery\\s*fee', 'additional\\s*fee']);
  if (feesRaw) result.fees = parseMoney(feesRaw);

  // Terms
  result.terms = extractAfterLabel(text, ['payment\\s*terms', 'terms', 'terms\\s*and\\s*conditions', 'terms\\s*&\\s*conditions']);

  // Notes
  result.notes = extractAfterLabel(text, ['notes?', 'special\\s*instructions', 'instructions', 'remarks?', 'comments?']);

  // Warranty
  result.warranty = extractAfterLabel(text, [
    'warranty', 'guarantee', 'guaranty', 'warranty\\s*statement',
  ]);

  // Line items — find the items section and parse table-like rows
  const itemsSection = text.match(/(?:line\s*items?|items?|description\s+qty|qty\s+description|description\s+quantity)[\s\S]*$/i);
  let itemsText = itemsSection ? itemsSection[0] : text;
  // Cut off at totals section
  const totalsStart = itemsText.match(/\n\s*(?:subtotal|sub\s*total|sub-total|tax|total|grand\s*total|total\s*due)\b/i);
  if (totalsStart) itemsText = itemsText.slice(0, totalsStart.index);

  const itemLines = itemsText.split('\n').map(l => l.trim()).filter(Boolean);

  // Skip header lines
  const dataRows = itemLines.filter(l =>
    !/^(line\s*items?|items?|description|qty|quantity|unit\s*price|price|amount|total)\b/i.test(l)
  );

  for (const row of dataRows) {
    // Pattern: description ... qty unit_price [total]
    // Try to find numbers at end: "Description 2 150.00" or "Description 2 150.00 300.00"
    const m = row.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s+\$?\s*(\d[\d,]*\.?\d*)\s*(?:\$?\s*(\d[\d,]*\.?\d*))?$/);
    if (m) {
      const description = m[1].replace(/\s*\$?\s*\d+$/, '').trim();
      const quantity = parseFloat(m[2]);
      const unit_price = parseFloat(m[3].replace(/,/g, ''));
      if (description && quantity > 0 && unit_price > 0) {
        result.items.push({ description, quantity, unit_price });
        continue;
      }
    }
    // Try "qty x description @ price" or "description @ price"
    const alt = row.match(/^(?:(\d+(?:\.\d+)?)\s*x\s+)?(.+?)(?:\s+@|\s+at)\s+\$?\s*(\d[\d,]*\.?\d*)$/i);
    if (alt) {
      const quantity = alt[1] ? parseFloat(alt[1]) : 1;
      const description = alt[2].trim();
      const unit_price = parseFloat(alt[3].replace(/,/g, ''));
      if (description && unit_price > 0) {
        result.items.push({ description, quantity, unit_price });
        continue;
      }
    }
    // Try "description $price" with implicit qty 1
    const simple = row.match(/^(.+?)\s+\$?\s*(\d[\d,]*\.?\d*)$/);
    if (simple) {
      const description = simple[1].trim();
      const unit_price = parseFloat(simple[2].replace(/,/g, ''));
      if (description.length > 2 && unit_price > 0 && !/^(subtotal|tax|total|discount|fee)/i.test(description)) {
        result.items.push({ description, quantity: 1, unit_price });
        continue;
      }
    }
  }

  // If no items found via rows, try the voice-style inline parsing
  if (result.items.length === 0) {
    const inline = text.match(/(.+?)(?:\s+at\s+|\s+@\s+|\s+for\s+)\$?\s*(\d[\d,]*\.?\d*)\s*(?:\/(?:hour|hr|unit|day|each))?/gi);
    if (inline) {
      for (const match of inline) {
        const m = match.match(/^(.+?)(?:\s+at\s+|\s+@\s+|\s+for\s+)\$?\s*(\d[\d,]*\.?\d*)/i);
        if (m) {
          result.items.push({
            description: m[1].trim(),
            quantity: 1,
            unit_price: parseFloat(m[2].replace(/,/g, '')),
          });
        }
      }
    }
  }

  return result;
}
