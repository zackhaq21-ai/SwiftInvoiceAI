import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { BusinessProfile, Client, Invoice, InvoiceItem, InvoiceStatus, Product, Expense, InvoicePayment, PaymentMethod } from '@/lib/types';
import { recalcInvoice } from '@/lib/calc';

export function useBusinessProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setProfile(null); setLoading(false); return; }
    const { data } = await supabase
      .from('business_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setProfile(data as BusinessProfile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (updates: Partial<BusinessProfile>) => {
    if (!profile || !user) return;
    const { data } = await supabase
      .from('business_profile')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select('*')
      .maybeSingle();
    if (data) setProfile(data as BusinessProfile);
  }, [profile, user]);

  const createProfile = useCallback(async (data: Partial<BusinessProfile> & { name: string }) => {
    if (!user) return null;
    const { data: row } = await supabase
      .from('business_profile')
      .insert({ user_id: user.id, ...data })
      .select('*')
      .maybeSingle();
    if (row) setProfile(row as BusinessProfile);
    return row as BusinessProfile | null;
  }, [user]);

  return { profile, loading, update, createProfile, reload: load };
}

export function useClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setClients([]); setLoading(false); return; }
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setClients((data as Client[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (client: Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    const { data } = await supabase
      .from('clients')
      .insert({ ...client, user_id: user.id })
      .select('*')
      .maybeSingle();
    if (data) setClients(prev => [data as Client, ...prev]);
    return data as Client | null;
  }, [user]);

  const update = useCallback(async (id: string, updates: Partial<Client>) => {
    const { data } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (data) setClients(prev => prev.map(c => c.id === id ? data as Client : c));
    return data as Client | null;
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from('clients').delete().eq('id', id);
    setClients(prev => prev.filter(c => c.id !== id));
  }, []);

  return { clients, loading, create, update, remove, reload: load };
}

export function useInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setInvoices([]); setLoading(false); return; }
    setError(null);
    const { data, error: err } = await supabase
      .from('invoices')
      .select('*, invoice_items(*), invoice_payments(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); }
    setInvoices((data as Invoice[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (
    invoice: Omit<Invoice, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'invoice_items' | 'invoice_payments'>,
    items: InvoiceItem[],
  ) => {
    if (!user) return null;
    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .insert({ ...invoice, user_id: user.id })
      .select('*')
      .maybeSingle();
    if (invErr) {
      (create as unknown as { _lastError?: string })._lastError = invErr.message;
      return null;
    }
    if (!invData) return null;
    const inv = invData as Invoice;

    if (items.length > 0) {
      const itemsWithInvoice = items.map((item, i) => {
        const { id: _id, invoice_id: _invId, user_id: _uid, created_at: _ca, updated_at: _ua, ...rest } = item as Omit<InvoiceItem, 'id' | 'invoice_id' | 'user_id' | 'created_at' | 'updated_at'>;
        void _id; void _invId; void _uid; void _ca; void _ua;
        return {
          ...rest,
          user_id: user.id,
          invoice_id: inv.id,
          sort_order: i,
        };
      });
      await supabase.from('invoice_items').insert(itemsWithInvoice);
    }

    const { data: full } = await supabase
      .from('invoices')
      .select('*, invoice_items(*), invoice_payments(*)')
      .eq('id', inv.id)
      .maybeSingle();
    if (full) setInvoices(prev => [full as Invoice, ...prev]);
    return full as Invoice | null;
  }, [user]);

  const update = useCallback(async (
    id: string,
    updates: Partial<Invoice>,
    items: InvoiceItem[],
  ) => {
    const { data: invData } = await supabase
      .from('invoices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (!invData) return null;

    await supabase.from('invoice_items').delete().eq('invoice_id', id);
    if (items.length > 0 && user) {
      const itemsWithInvoice = items.map((item, i) => {
        const { id: _id, invoice_id: _invId, user_id: _uid, created_at: _ca, updated_at: _ua, ...rest } = item as Omit<InvoiceItem, 'id' | 'invoice_id' | 'user_id' | 'created_at' | 'updated_at'>;
        void _id; void _invId; void _uid; void _ca; void _ua;
        return {
          ...rest,
          user_id: user.id,
          invoice_id: id,
          sort_order: i,
        };
      });
      await supabase.from('invoice_items').insert(itemsWithInvoice);
    }

    const { data: full } = await supabase
      .from('invoices')
      .select('*, invoice_items(*), invoice_payments(*)')
      .eq('id', id)
      .maybeSingle();
    if (full) {
      setInvoices(prev => prev.map(inv => inv.id === id ? full as Invoice : inv));
    }
    return full as Invoice | null;
  }, [user]);

  const updateStatus = useCallback(async (id: string, status: InvoiceStatus) => {
    const { data } = await supabase
      .from('invoices')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (data) {
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...(data as Invoice) } : inv));
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from('invoices').delete().eq('id', id);
    setInvoices(prev => prev.filter(inv => inv.id !== id));
  }, []);

  return { invoices, loading, error, create, update, updateStatus, remove, reload: load, refresh: load };
}

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setProducts([]); setLoading(false); return; }
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setProducts((data as Product[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (product: Omit<Product, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    const { data } = await supabase
      .from('products')
      .insert({ ...product, user_id: user.id })
      .select('*')
      .maybeSingle();
    if (data) setProducts(prev => [data as Product, ...prev]);
    return data as Product | null;
  }, [user]);

  const update = useCallback(async (id: string, updates: Partial<Product>) => {
    const { data } = await supabase
      .from('products')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (data) setProducts(prev => prev.map(p => p.id === id ? data as Product : p));
    return data as Product | null;
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  return { products, loading, create, update, remove, reload: load };
}

export function useExpenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setExpenses([]); setLoading(false); return; }
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false });
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const create = useCallback(async (expense: Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    const { data } = await supabase
      .from('expenses')
      .insert({ ...expense, user_id: user.id })
      .select('*')
      .maybeSingle();
    if (data) setExpenses(prev => [data as Expense, ...prev]);
    return data as Expense | null;
  }, [user]);

  const update = useCallback(async (id: string, updates: Partial<Expense>) => {
    const { data } = await supabase
      .from('expenses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (data) setExpenses(prev => prev.map(e => e.id === id ? data as Expense : e));
    return data as Expense | null;
  }, []);

  const remove = useCallback(async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  return { expenses, loading, create, update, remove, reload: load };
}

export function useInvoicePayments(invoiceId: string | undefined) {
  const { user } = useAuth();
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !invoiceId) { setPayments([]); setLoading(false); return; }
    const { data } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: false });
    setPayments((data as InvoicePayment[]) || []);
    setLoading(false);
  }, [user, invoiceId]);

  useEffect(() => { load(); }, [load]);

  const addPayment = useCallback(async (amount: number, method: PaymentMethod, reference?: string, notes?: string) => {
    if (!user || !invoiceId) return null;
    const { data } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        user_id: user.id,
        amount,
        method,
        reference: reference || null,
        notes: notes || null,
        paid_at: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle();
    if (data) setPayments(prev => [data as InvoicePayment, ...prev]);
    return data as InvoicePayment | null;
  }, [user, invoiceId]);

  const removePayment = useCallback(async (id: string) => {
    await supabase.from('invoice_payments').delete().eq('id', id);
    setPayments(prev => prev.filter(p => p.id !== id));
  }, []);

  return { payments, loading, addPayment, removePayment, reload: load };
}

export function calcInvoiceTotals(items: InvoiceItem[], taxRate: number, discount: number) {
  return recalcInvoice(items, taxRate, discount);
}
