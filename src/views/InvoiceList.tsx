import { useState, useMemo } from 'react';
import {
  Plus, Search, FileText, Eye, Pencil, Trash2,
  ChevronDown, Mic,
} from 'lucide-react';
import { useInvoices, useBusinessProfile } from '@/lib/hooks';
import { formatCurrency, formatDate, statusColor } from '@/lib/format';
import type { View } from '@/App';
import type { InvoiceStatus } from '@/lib/types';

interface InvoiceListProps {
  onNavigate: (view: View) => void;
}

const STATUS_FILTERS: (InvoiceStatus | 'all')[] = ['all', 'draft', 'sent', 'paid', 'overdue'];

export default function InvoiceList({ onNavigate }: InvoiceListProps) {
  const { invoices, loading, remove, updateStatus } = useInvoices();
  const { profile } = useBusinessProfile();
  const symbol = profile?.currency_symbol || '$';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.document_type === 'estimate') return false;
      const matchesSearch =
        !search ||
        inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
        (inv.client_name || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const invOnly = invoices.filter(i => i.document_type !== 'estimate');
    const counts: Record<string, number> = { all: invOnly.length, draft: 0, sent: 0, paid: 0, overdue: 0 };
    invOnly.forEach(inv => { counts[inv.status] = (counts[inv.status] || 0) + 1; });
    return counts;
  }, [invoices]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-pulse pb-bottom-nav md:pb-10">
        <div className="h-8 w-40 bg-slate-200 rounded-lg mb-6" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in pb-bottom-nav md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">{statusCounts.all} total</p>
        </div>
        <div className="hidden md:flex gap-2">
          <button onClick={() => onNavigate({ name: 'voice' })} className="btn-secondary">
            <Mic className="w-4 h-4" />
            Voice
          </button>
          <button onClick={() => onNavigate({ name: 'editor' })} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3 md:mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search invoices or clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-10 min-touch"
        />
      </div>

      {/* Filters — horizontal scroll on all sizes */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-thin -mx-1 px-1 mb-4 md:mb-6 pb-1">
        {STATUS_FILTERS.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 min-touch ${
              statusFilter === status
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className={`text-xs ${statusFilter === status ? 'text-slate-300' : 'text-slate-400'}`}>
              {statusCounts[status] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="card p-8 md:p-12 text-center">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 md:w-8 md:h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">
            {search || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {search || statusFilter !== 'all' ? 'Try adjusting your search or filters' : 'Create your first invoice to get started'}
          </p>
          {!search && statusFilter === 'all' && (
            <button onClick={() => onNavigate({ name: 'editor' })} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {filtered.map(inv => {
              const sc = statusColor(inv.status);
              return (
                <div
                  key={inv.id}
                  className="card p-3.5 active:scale-[0.99] transition-transform"
                >
                  <button
                    onClick={() => onNavigate({ name: 'preview', invoiceId: inv.id })}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 text-sm truncate">{inv.invoice_number}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{inv.client_name || 'No client'}</p>
                      </div>
                      <span className="font-bold text-slate-900 text-sm shrink-0">{formatCurrency(inv.total, symbol)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`badge ${sc.bg} ${sc.text} text-[10px]`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatDate(inv.due_date)}</span>
                    </div>
                    {inv.payment_status && inv.payment_status !== 'unpaid' && (
                      <span className={`block mt-1.5 text-[10px] font-medium ${
                        inv.payment_status === 'paid' ? 'text-emerald-600' :
                        inv.payment_status === 'pending' ? 'text-amber-600' : 'text-slate-400'
                      }`}>
                        {inv.payment_status === 'paid' ? 'Paid online' :
                         inv.payment_status === 'pending' ? 'Payment pending' : inv.payment_status}
                      </span>
                    )}
                  </button>
                  {/* Quick actions */}
                  <div className="flex items-center gap-1 mt-2.5 pt-2.5 border-t border-slate-50">
                    <button
                      onClick={() => onNavigate({ name: 'preview', invoiceId: inv.id })}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors min-touch"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => onNavigate({ name: 'editor', invoiceId: inv.id })}
                      className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors min-touch"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(inv.id)}
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
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3.5">Invoice</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3.5">Client</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Issued</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3.5 hidden lg:table-cell">Due</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3.5">Status</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3.5">Amount</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3.5 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(inv => {
                    const sc = statusColor(inv.status);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900 text-sm">{inv.invoice_number}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-slate-600">{inv.client_name || '—'}</span>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-sm text-slate-500">{formatDate(inv.issue_date)}</span>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <span className="text-sm text-slate-500">{formatDate(inv.due_date)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="relative inline-block">
                            <select
                              value={inv.status}
                              onChange={e => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                              className={`badge ${sc.bg} ${sc.text} appearance-none cursor-pointer pr-6 border-0 outline-none`}
                            >
                              <option value="draft">Draft</option>
                              <option value="sent">Sent</option>
                              <option value="paid">Paid</option>
                              <option value="overdue">Overdue</option>
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          </div>
                          {inv.payment_status && inv.payment_status !== 'unpaid' && (
                            <span className={`block mt-1.5 text-[10px] font-medium ${
                              inv.payment_status === 'paid' ? 'text-emerald-600' :
                              inv.payment_status === 'pending' ? 'text-amber-600' : 'text-slate-400'
                            }`}>
                              {inv.payment_status === 'paid' ? 'Paid online' :
                               inv.payment_status === 'pending' ? 'Payment pending' : inv.payment_status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-semibold text-slate-900 text-sm">{formatCurrency(inv.total, symbol)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onNavigate({ name: 'preview', invoiceId: inv.id })}
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onNavigate({ name: 'editor', invoiceId: inv.id })}
                              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(inv.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
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
        onClick={() => onNavigate({ name: 'editor' })}
        className="md:hidden fixed right-4 bottom-24 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xl shadow-indigo-600/30 active:scale-95 transition-transform z-30 safe-area-pb"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="New invoice"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Delete this invoice?</h3>
            <p className="text-sm text-slate-500 mt-1">This action cannot be undone. The invoice and all its line items will be permanently removed.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1 min-touch">
                Cancel
              </button>
              <button
                onClick={() => { remove(confirmDelete); setConfirmDelete(null); }}
                className="btn flex-1 bg-red-600 text-white hover:bg-red-700 min-touch"
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
