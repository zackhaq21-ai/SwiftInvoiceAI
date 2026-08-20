import { useState, useMemo } from 'react';
import {
  FileText, Plus, Search, Trash2, Pencil, Eye,
  ArrowRight, Loader2, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { useInvoices, useBusinessProfile } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDate, todayISO, addDays } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Invoice, InvoiceStatus } from '@/lib/types';
import type { View } from '@/App';

interface EstimatesProps {
  onNavigate: (view: View) => void;
}

type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined';

const STATUS_META: Record<EstimateStatus, { label: string; bg: string; text: string; dot: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', icon: FileText },
  sent: { label: 'Sent', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500', icon: Clock },
  accepted: { label: 'Accepted', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', icon: CheckCircle2 },
  declined: { label: 'Declined', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500', icon: XCircle },
};

export default function Estimates({ onNavigate }: EstimatesProps) {
  const { invoices, updateStatus, remove, loading } = useInvoices();
  const { profile } = useBusinessProfile();
  const { user } = useAuth();
  const symbol = profile?.currency_symbol || '$';
  const accent = profile?.accent_color || '#111827';

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const estimates = useMemo(() => invoices.filter(i => i.document_type === 'estimate'), [invoices]);

  const filtered = useMemo(() => {
    return estimates.filter(e => {
      const matchesSearch = !search ||
        (e.estimate_number || e.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.client_name || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [estimates, search, filterStatus]);

  const statusTabs = ['all', 'draft', 'sent', 'accepted', 'declined'];

  const handleConvert = async (estimate: Invoice) => {
    if (!user || !profile) return;
    setConvertingId(estimate.id);
    try {
      const newInvoiceNumber = `${profile.invoice_prefix}-${String(profile.next_invoice_number).padStart(4, '0')}`;

      const { data: newInv, error } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          invoice_number: newInvoiceNumber,
          client_id: estimate.client_id,
          client_name: estimate.client_name,
          client_email: estimate.client_email,
          client_phone: estimate.client_phone,
          client_address: estimate.client_address,
          work_order_number: estimate.work_order_number,
          technician_name: estimate.technician_name,
          status: 'draft',
          payment_status: 'unpaid',
          issue_date: todayISO(),
          due_date: addDays(todayISO(), 30),
          subtotal: estimate.subtotal,
          tax_rate: estimate.tax_rate,
          tax_amount: estimate.tax_amount,
          discount_amount: estimate.discount_amount,
          fees_amount: estimate.fees_amount,
          deposit_amount: estimate.deposit_amount,
          shipping_amount: estimate.shipping_amount,
          total: estimate.total,
          notes: estimate.notes,
          terms: estimate.terms,
          warranty: estimate.warranty,
          metadata: estimate.metadata,
          industry_template: estimate.industry_template,
          document_type: 'invoice',
          parent_invoice_id: estimate.id,
          converted_at: new Date().toISOString(),
        })
        .select('*')
        .maybeSingle();

      if (error || !newInv) throw error || new Error('Failed to create invoice');
      const inv = newInv as Invoice;

      const items = estimate.invoice_items || [];
      if (items.length > 0) {
        const itemsCopy = items.map((item, i) => {
          const { id: _id, invoice_id: _invId, user_id: _uid, ...rest } = item;
          void _id; void _invId; void _uid;
          return { ...rest, user_id: user.id, invoice_id: inv.id, sort_order: i };
        });
        await supabase.from('invoice_items').insert(itemsCopy);
      }

      await supabase
        .from('business_profile')
        .update({ next_invoice_number: profile.next_invoice_number + 1 })
        .eq('id', profile.id);

      updateStatus(estimate.id, 'paid');
      onNavigate({ name: 'preview', invoiceId: inv.id });
    } catch (err) {
      console.error('Convert failed:', err);
    } finally {
      setConvertingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in pb-bottom-nav md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Estimates</h1>
          <p className="text-sm text-slate-500 mt-1 hidden sm:block">Create quotes and convert them to invoices when accepted</p>
        </div>
        <button
          onClick={() => onNavigate({ name: 'editor', invoiceId: undefined })}
          className="btn-primary"
          style={{ background: accent }}
        >
          <Plus className="w-4 h-4" />
          New Estimate
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3 md:mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search estimates…"
            className="input pl-10 min-touch"
          />
        </div>
        <div className="flex gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50 overflow-x-auto scrollbar-thin">
          {statusTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-touch ${filterStatus === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-8 md:p-12 text-center">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 md:w-8 md:h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">{estimates.length === 0 ? 'No estimates yet' : 'No matching estimates'}</p>
          <p className="text-sm text-slate-400 mt-1">{estimates.length === 0 ? 'Create a quote to send to your client' : 'Try a different search or filter'}</p>
          {estimates.length === 0 && (
            <button onClick={() => onNavigate({ name: 'editor' })} className="btn-primary mt-4" style={{ background: accent }}>
              <Plus className="w-4 h-4" />
              Create Estimate
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {filtered.map(est => {
              const meta = STATUS_META[est.status as EstimateStatus] || STATUS_META.draft;
              const Icon = meta.icon;
              return (
                <div key={est.id} className="card p-3.5">
                  <button
                    onClick={() => onNavigate({ name: 'preview', invoiceId: est.id })}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-sm truncate">{est.estimate_number || est.invoice_number}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{est.client_name || 'No client'}</p>
                        {est.converted_at && (
                          <span className="text-[10px] font-medium text-emerald-600">Converted to invoice</span>
                        )}
                      </div>
                      <span className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(est.total, symbol)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`badge ${meta.bg} ${meta.text} text-[10px]`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDate(est.issue_date)}</span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-slate-50">
                    {!est.converted_at && est.status !== 'declined' && (
                      <button
                        onClick={() => handleConvert(est)}
                        disabled={convertingId === est.id}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50 min-touch"
                        style={{ background: accent }}
                      >
                        {convertingId === est.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ArrowRight className="w-3.5 h-3.5" /> Convert</>}
                      </button>
                    )}
                    <button
                      onClick={() => onNavigate({ name: 'preview', invoiceId: est.id })}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors min-touch"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => onNavigate({ name: 'editor', invoiceId: est.id })}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors min-touch"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(est)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors min-touch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Estimate</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Client</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Amount</th>
                  <th className="px-6 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(est => {
                  const meta = STATUS_META[est.status as EstimateStatus] || STATUS_META.draft;
                  return (
                    <tr key={est.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="font-medium text-slate-900 text-sm">{est.estimate_number || est.invoice_number}</span>
                        {est.converted_at && (
                          <span className="block text-[10px] font-medium text-emerald-600 mt-0.5">Converted to invoice</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="text-sm text-slate-600">{est.client_name || '—'}</span>
                      </td>
                      <td className="px-6 py-3.5 hidden md:table-cell">
                        <span className="text-sm text-slate-500">{formatDate(est.issue_date)}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <select
                          value={est.status}
                          onChange={e => updateStatus(est.id, e.target.value as InvoiceStatus)}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-full cursor-pointer border-0 outline-none ${meta.bg} ${meta.text}`}
                        >
                          {(['draft', 'sent', 'accepted', 'declined'] as const).map(s => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="font-semibold text-slate-900 text-sm">{formatCurrency(est.total, symbol)}</span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          {!est.converted_at && est.status !== 'declined' && (
                            <button
                              onClick={() => handleConvert(est)}
                              disabled={convertingId === est.id}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
                              style={{ background: accent }}
                              title="Convert to invoice"
                            >
                              {convertingId === est.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><ArrowRight className="w-3.5 h-3.5 inline" /> Invoice</>}
                            </button>
                          )}
                          <button
                            onClick={() => onNavigate({ name: 'preview', invoiceId: est.id })}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onNavigate({ name: 'editor', invoiceId: est.id })}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(est)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => onNavigate({ name: 'editor', invoiceId: undefined })}
        className="md:hidden fixed right-4 bottom-24 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform z-30"
        style={{ background: accent }}
        aria-label="New estimate"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900">Delete estimate?</h3>
            <p className="text-sm text-slate-500 mt-1">"{deleteTarget.estimate_number || deleteTarget.invoice_number}" will be permanently removed.</p>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={async () => { await remove(deleteTarget.id); setDeleteTarget(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
