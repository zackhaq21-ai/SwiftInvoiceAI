import { describe, it, expect } from 'vitest';
import { parseContactsCSV, detectDuplicates, toClientInsert, generateCSVTemplate } from '@/lib/contactImport';
import type { Client } from '@/lib/types';

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'c-' + Math.random().toString(36).slice(2),
    user_id: 'u1',
    name: 'Test',
    email: null,
    phone: null,
    address: null,
    company: null,
    notes: null,
    tax_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('parseContactsCSV', () => {
  it('parses basic CSV with headers', () => {
    const csv = 'Name,Email,Phone,Company,Notes\nJohn Doe,john@test.com,555-1234,Acme,VIP\nJane Smith,jane@test.com,555-5678,Beta Co,\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].name).toBe('John Doe');
    expect(contacts[0].email).toBe('john@test.com');
    expect(contacts[0].phone).toBe('555-1234');
    expect(contacts[0].company).toBe('Acme');
    expect(contacts[0].notes).toBe('VIP');
  });

  it('handles different header names', () => {
    const csv = 'Full Name,Email Address,Telephone\nBob,bob@test.com,555-0000\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts[0].name).toBe('Bob');
    expect(contacts[0].email).toBe('bob@test.com');
    expect(contacts[0].phone).toBe('555-0000');
  });

  it('uses first column as name if no Name header', () => {
    const csv = 'Customer,Email\nAlice,alice@test.com\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts[0].name).toBe('Alice');
  });

  it('handles quoted CSV fields with commas', () => {
    const csv = 'Name,Email\n"Doe, John",john@test.com\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts[0].name).toBe('Doe, John');
  });

  it('handles escaped quotes in CSV', () => {
    const csv = 'Name,Notes\n"John ""JD"" Doe",Important\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts[0].name).toBe('John "JD" Doe');
  });

  it('skips rows with empty name', () => {
    const csv = 'Name,Email\nJohn,john@test.com\n,jane@test.com\nBob,bob@test.com\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].name).toBe('John');
    expect(contacts[1].name).toBe('Bob');
  });

  it('returns empty array for empty input', () => {
    expect(parseContactsCSV('')).toEqual([]);
    expect(parseContactsCSV('   ')).toEqual([]);
  });

  it('handles Windows line endings', () => {
    const csv = 'Name,Email\r\nJohn,john@test.com\r\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].name).toBe('John');
  });

  it('normalizes headers with spaces', () => {
    const csv = 'First Name,Email Address\nAlice,alice@test.com\n';
    const contacts = parseContactsCSV(csv);
    expect(contacts[0].name).toBe('Alice');
  });
});

describe('detectDuplicates', () => {
  it('detects duplicates by name', () => {
    const existing = [makeClient({ name: 'John Doe', email: null })];
    const parsed = [{ name: 'John Doe', email: '', phone: '', company: '', notes: '' }];
    const result = detectDuplicates(parsed, existing);
    expect(result.duplicates).toContain(0);
  });

  it('detects duplicates by email', () => {
    const existing = [makeClient({ name: 'Different Name', email: 'john@test.com' })];
    const parsed = [{ name: 'John Doe', email: 'john@test.com', phone: '', company: '', notes: '' }];
    const result = detectDuplicates(parsed, existing);
    expect(result.duplicates).toContain(0);
  });

  it('is case-insensitive for name matching', () => {
    const existing = [makeClient({ name: 'John Doe' })];
    const parsed = [{ name: 'john doe', email: '', phone: '', company: '', notes: '' }];
    const result = detectDuplicates(parsed, existing);
    expect(result.duplicates).toContain(0);
  });

  it('detects duplicates within the same batch', () => {
    const parsed = [
      { name: 'Alice', email: '', phone: '', company: '', notes: '' },
      { name: 'Alice', email: '', phone: '', company: '', notes: '' },
    ];
    const result = detectDuplicates(parsed, []);
    expect(result.skipped).toContain(1);
  });

  it('does not flag unique contacts as duplicates', () => {
    const existing = [makeClient({ name: 'John' })];
    const parsed = [
      { name: 'Alice', email: 'alice@test.com', phone: '', company: '', notes: '' },
      { name: 'Bob', email: 'bob@test.com', phone: '', company: '', notes: '' },
    ];
    const result = detectDuplicates(parsed, existing);
    expect(result.duplicates).toHaveLength(0);
  });

  it('handles empty existing clients', () => {
    const parsed = [{ name: 'Alice', email: '', phone: '', company: '', notes: '' }];
    const result = detectDuplicates(parsed, []);
    expect(result.duplicates).toHaveLength(0);
  });
});

describe('toClientInsert', () => {
  it('converts parsed contact to client insert format', () => {
    const contact = { name: 'John', email: 'john@test.com', phone: '555-1234', company: 'Acme', notes: 'VIP' };
    const client = toClientInsert(contact);
    expect(client.name).toBe('John');
    expect(client.email).toBe('john@test.com');
    expect(client.phone).toBe('555-1234');
    expect(client.company).toBe('Acme');
    expect(client.notes).toBe('VIP');
    expect(client.address).toBeNull();
    expect(client.tax_id).toBeNull();
  });

  it('converts empty strings to null', () => {
    const contact = { name: 'John', email: '', phone: '', company: '', notes: '' };
    const client = toClientInsert(contact);
    expect(client.email).toBeNull();
    expect(client.phone).toBeNull();
    expect(client.company).toBeNull();
    expect(client.notes).toBeNull();
  });
});

describe('generateCSVTemplate', () => {
  it('generates a valid CSV template string', () => {
    const template = generateCSVTemplate();
    expect(template).toContain('Name');
    expect(template).toContain('Email');
    expect(template).toContain('Phone');
    expect(template).toContain('Company');
    expect(template).toContain('Notes');
  });

  it('includes an example row', () => {
    const template = generateCSVTemplate();
    expect(template).toContain('John Doe');
  });
});
