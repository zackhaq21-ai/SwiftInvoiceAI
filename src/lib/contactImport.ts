import type { Client } from './types';

export interface ParsedContact {
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
}

export interface ContactImportResult {
  contacts: ParsedContact[];
  duplicates: number[];
  skipped: number[];
  errors: string[];
}

const FIELD_ALIASES: Record<string, keyof ParsedContact> = {
  name: 'name',
  full_name: 'name',
  firstname: 'name',
  first_name: 'name',
  client: 'name',
  customer: 'name',
  contact: 'name',
  email: 'email',
  email_address: 'email',
  e_mail: 'email',
  mail: 'email',
  phone: 'phone',
  phone_number: 'phone',
  telephone: 'phone',
  tel: 'phone',
  mobile: 'phone',
  cell: 'phone',
  company: 'company',
  organization: 'company',
  org: 'company',
  business: 'company',
  notes: 'notes',
  note: 'notes',
  comment: 'notes',
  comments: 'notes',
};

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, '_');
}

export function parseContactsCSV(csvText: string): ParsedContact[] {
  const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]).map(normalizeHeader);
  const contacts: ParsedContact[] = [];

  // Build column index map
  const columnMap: Record<keyof ParsedContact, number> = {
    name: -1, email: -1, phone: -1, company: -1, notes: -1,
  };

  for (let i = 0; i < headers.length; i++) {
    const alias = FIELD_ALIASES[headers[i]];
    if (alias && columnMap[alias] === -1) {
      columnMap[alias] = i;
    }
  }

  // If no name column found, try first column as name
  if (columnMap.name === -1) {
    columnMap.name = 0;
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const name = values[columnMap.name] || '';
    if (!name.trim()) continue;

    contacts.push({
      name: name.trim(),
      email: (values[columnMap.email] || '').trim(),
      phone: (values[columnMap.phone] || '').trim(),
      company: (values[columnMap.company] || '').trim(),
      notes: (values[columnMap.notes] || '').trim(),
    });
  }

  return contacts;
}

export function detectDuplicates(
  parsed: ParsedContact[],
  existing: Client[],
): ContactImportResult {
  const duplicates: number[] = [];
  const skipped: number[] = [];
  const errors: string[] = [];

  const existingByName = new Map(
    existing.map(c => [c.name.toLowerCase().trim(), c])
  );
  const existingByEmail = new Map(
    existing.filter(c => c.email).map(c => [c.email!.toLowerCase().trim(), c])
  );

  const seenInBatch = new Set<string>();

  for (let i = 0; i < parsed.length; i++) {
    const contact = parsed[i];
    const nameKey = contact.name.toLowerCase().trim();
    const emailKey = contact.email.toLowerCase().trim();

    if (seenInBatch.has(nameKey)) {
      skipped.push(i);
      continue;
    }

    if (existingByName.has(nameKey) || (emailKey && existingByEmail.has(emailKey))) {
      duplicates.push(i);
    }

    seenInBatch.add(nameKey);
  }

  return { contacts: parsed, duplicates, skipped, errors };
}

export function toClientInsert(
  contact: ParsedContact,
): Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  return {
    name: contact.name,
    email: contact.email || null,
    phone: contact.phone || null,
    address: null,
    company: contact.company || null,
    notes: contact.notes || null,
    tax_id: null,
  };
}

export function generateCSVTemplate(): string {
  return 'Name,Email,Phone,Company,Notes\nJohn Doe,john@example.com,555-1234,Acme Corp,VIP customer\n';
}
