import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Pencil, Receipt, TrendingDown, Search,
  X, Loader2, Tag, Calendar, DollarSign,
} from 'lucide-react';
import { useExpenses, useBusinessProfile } from '@/lib/hooks';
import { formatCurrency, formatDate, todayISO } from '@/lib/format';
import type { Expense } from '@/lib/types';
import type { View } from '@/App';

const CATEGORIES = ['materials', 'fuel', 'tools', 'software', 'labor', 'rent', 'utilities', 'marketing', 'travel', 'other'];

const CATEGORY_COLORS: Record<string, string> = {
  materials: 'bg-blue-50 text-blue-600',
  fuel: 'bg-amber-50 text-amber-600',
  tools: 'bg-slate-100 text-slate-600',
  software: 'bg-emerald-50 text-emerald-600',
  labor: 'bg-purple-50 text-purple-600',
  rent: 'bg-red-50 text-red-600',
  utilities: 'bg-cyan-50 text-cyan-600',
  marketing: 'bg-pink-50 text-pink-600',
  travel: 'bg-indigo-50 text-indigo-600',
  other: 'bg-gray-100 text-gray-500',
};

interface ExpensesProps {
  onNavigate: (view: View) => void;
}

export default function Expenses({ onNavigate }: ExpensesProps) {
  const { expenses, loading, create, update, remove } = useExpenses();
  const { profile } = useBusinessProfile();
  const symbol = profile?.currency_symbol || '$';

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const filtered = useMemo(() => {
    return expenses.filter(e => {
      const matchesSearch = !search ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        (e.vendor || '').toLowerCase().includes(search.toLowerCase());
      const matchesCat = filterCat === 'all' || e.category === filterCat;
      return matchesSearch && matchesCat;
    });
  }, [expenses, search, filterCat]);

  const totals = useMemo(() => {
    const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
    const billable = filtered.filter(e => e.is_billable).reduce((sum, e) => sum + (e.amount || 0), 0);
    const byCat = CATEGORIES.map(cat => ({
      cat,
      amount: filtered.filter(e => e.category === cat).reduce((sum, e) => sum + (e.amount || 0), 0),
    })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
    return { total, billable, byCat };
  }, [filtered]);

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-28 bg-slate-100 rounded-2xl" />)}</div>
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
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-1 hidden sm:block">Track business costs and billable spending</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="btn-primary hidden md:flex"
          style={{ background: profile?.accent_color || '#111827' }}
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
        <div className="card p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-base md:text-2xl font-bold text-slate-900 truncate">{formatCurrency(totals.total, symbol)}</p>
              <p className="text-[10px] md:text-sm text-slate-500">Total</p>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-base md:text-2xl font-bold text-slate-900 truncate">{formatCurrency(totals.billable, symbol)}</p>
              <p className="text-[10px] md:text-sm text-slate-500">Billable</p>
            </div>
          </div>
        </div>
        <div className="card p-3 md:p-5">
          <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Receipt className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
            </div>
            <div className="min-w-0">
              <p className="text-base md:text-2xl font-bold text-slate-900 truncate">{filtered.length}</p>
              <p className="text-[10px] md:text-sm text-slate-500">Records</p>
            </div>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      {totals.byCat.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">By Category</h2>
          <div className="space-y-3">
            {totals.byCat.map(({ cat, amount }) => {
              const pct = totals.total > 0 ? (amount / totals.total) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-600 capitalize">{cat}</span>
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(amount, symbol)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: profile?.accent_color || '#111827' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search expenses…"
            className="input pl-10 min-touch"
          />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="input sm:w-48 cursor-pointer min-touch">
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">{expenses.length === 0 ? 'No expenses yet' : 'No matching expenses'}</p>
          <p className="text-sm text-slate-400 mt-1">{expenses.length === 0 ? 'Start tracking your business costs' : 'Try a different search or filter'}</p>
          {expenses.length === 0 && (
            <button onClick={() => { setEditing(null); setShowModal(true); }} className="btn-primary mt-4" style={{ background: profile?.accent_color || '#111827' }}>
              <Plus className="w-4 h-4" />
              Add Expense
            </button>
          )}
        </div>
      ) : (
        <>
        {/* Mobile card list */}
        <div className="md:hidden space-y-2">
          {filtered.map(exp => (
            <div key={exp.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 text-sm truncate">{exp.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.other}`}>{exp.category}</span>
                    {exp.vendor && <span className="text-xs text-slate-400 truncate">{exp.vendor}</span>}
                    {exp.is_billable && <span className="text-[10px] font-bold uppercase text-emerald-600">Billable</span>}
                  </div>
                </div>
                <span className="font-semibold text-slate-900 text-sm shrink-0">{formatCurrency(exp.amount, symbol)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{formatDate(exp.expense_date)}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(exp); setShowModal(true); }} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors min-touch">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(exp)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors min-touch">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Description</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden sm:table-cell">Category</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Vendor</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Date</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Amount</th>
                  <th className="px-6 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{exp.description}</span>
                        {exp.is_billable && <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Billable</span>}
                      </div>
                      <p className="text-xs text-slate-400 sm:hidden capitalize">{exp.category}</p>
                    </td>
                    <td className="px-6 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.other}`}>
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 hidden md:table-cell">
                      <span className="text-sm text-slate-600">{exp.vendor || '—'}</span>
                    </td>
                    <td className="px-6 py-3.5 hidden lg:table-cell">
                      <span className="text-sm text-slate-500">{formatDate(exp.expense_date)}</span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(exp.amount, symbol)}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditing(exp); setShowModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(exp)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => { setEditing(null); setShowModal(true); }}
        className="md:hidden fixed right-4 bottom-24 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 transition-transform z-30"
        style={{ background: profile?.accent_color || '#111827' }}
        aria-label="Add expense"
      >
        <Plus className="w-6 h-6" strokeWidth={2.5} />
      </button>

      {/* Add/Edit modal */}
      {showModal && (
        <ExpenseModal
          expense={editing}
          symbol={symbol}
          accent={profile?.accent_color || '#111827'}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (editing) {
              await update(editing.id, data);
            } else {
              await create(data);
            }
            setShowModal(false);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900">Delete expense?</h3>
            <p className="text-sm text-slate-500 mt-1">"{deleteTarget.description}" will be permanently removed.</p>
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

function ExpenseModal({
  expense, symbol, accent, onClose, onSave,
}: {
  expense: Expense | null;
  symbol: string;
  accent: string;
  onClose: () => void;
  onSave: (data: Omit<Expense, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>;
}) {
  const [description, setDescription] = useState(expense?.description || '');
  const [category, setCategory] = useState(expense?.category || 'other');
  const [vendor, setVendor] = useState(expense?.vendor || '');
  const [amount, setAmount] = useState(expense?.amount?.toString() || '');
  const [expenseDate, setExpenseDate] = useState(expense?.expense_date || todayISO());
  const [isBillable, setIsBillable] = useState(expense?.is_billable || false);
  const [notes, setNotes] = useState(expense?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim() || !amount) return;
    setSaving(true);
    await onSave({
      description: description.trim(),
      category,
      vendor: vendor.trim() || null,
      amount: parseFloat(amount) || 0,
      expense_date: expenseDate,
      is_billable: isBillable,
      notes: notes.trim() || null,
      receipt_url: expense?.receipt_url || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">{expense ? 'Edit Expense' : 'Add Expense'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="label">Description <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this expense?"
              className="input"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="input cursor-pointer">
                {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{symbol}</span>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="input pl-7"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vendor</label>
              <input
                type="text"
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                placeholder="Who you paid"
                className="input"
              />
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional details"
              className="input resize-none"
            />
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={e => setIsBillable(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: accent }}
            />
            <div>
              <p className="text-sm font-medium text-slate-700">Billable to client</p>
              <p className="text-xs text-slate-400">Mark if this cost can be passed on to a customer</p>
            </div>
          </label>
        </div>

        <div className="flex gap-3 p-6 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!description.trim() || !amount || saving}
            className="flex-1 btn-primary disabled:opacity-50"
            style={{ background: accent }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {expense ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </div>
    </div>
  );
}
