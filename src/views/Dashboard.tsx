import { useMemo } from 'react';
import {
  TrendingUp, FileText, Clock, CheckCircle2, DollarSign,
  ArrowUpRight, ArrowDownRight, Mic, Plus, RefreshCw, AlertCircle, Sparkles, Zap,
} from 'lucide-react';
import { useInvoices, useBusinessProfile } from '@/lib/hooks';
import { formatCurrency, statusColor, relativeTime } from '@/lib/format';
import type { View } from '@/App';

interface DashboardProps {
  onNavigate: (view: View) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { invoices, loading, error, refresh } = useInvoices();
  const { profile } = useBusinessProfile();
  const symbol = profile?.currency_symbol || '$';
  const accent = profile?.accent_color || '#111827';

  const stats = useMemo(() => {
    const invOnly = invoices.filter(i => i.document_type !== 'estimate');
    const paid = invOnly.filter(i => i.status === 'paid');
    const sent = invOnly.filter(i => i.status === 'sent');
    const overdue = invOnly.filter(i => i.status === 'overdue');
    const draft = invOnly.filter(i => i.status === 'draft');

    const totalRevenue = paid.reduce((sum, i) => sum + (i.total || 0), 0);
    const outstanding = (sent.reduce((sum, i) => sum + (i.total || 0), 0)) + (overdue.reduce((sum, i) => sum + (i.total || 0), 0));
    const overdueAmount = overdue.reduce((sum, i) => sum + (i.total || 0), 0);

    const months: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthRevenue = paid
        .filter(inv => {
          const d = new Date(inv.issue_date);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum, inv) => sum + (inv.total || 0), 0);
      months.push({
        label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        value: monthRevenue,
      });
    }

    const maxMonth = Math.max(...months.map(m => m.value), 1);

    return {
      totalRevenue,
      outstanding,
      overdueAmount,
      paidCount: paid.length,
      sentCount: sent.length,
      overdueCount: overdue.length,
      draftCount: draft.length,
      totalCount: invOnly.length,
      months,
      maxMonth,
    };
  }, [invoices]);

  const recentInvoices = invoices.filter(i => i.document_type !== 'estimate').slice(0, 6);

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4 md:space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 md:h-32 bg-slate-100 rounded-2xl" />
            ))}
          </div>
          <div className="h-48 md:h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto">
        <div className="card p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-slate-700 font-medium">Couldn't load your dashboard</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">{error}</p>
          <button onClick={refresh} className="btn-primary">
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Money Collected',
      value: formatCurrency(stats.totalRevenue, symbol),
      icon: DollarSign,
      change: stats.paidCount > 0 ? `${stats.paidCount} paid` : '—',
      changeUp: true,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(stats.outstanding, symbol),
      icon: Clock,
      change: `${stats.sentCount + stats.overdueCount} unpaid`,
      changeUp: false,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Overdue',
      value: formatCurrency(stats.overdueAmount, symbol),
      icon: TrendingUp,
      change: `${stats.overdueCount} invoice${stats.overdueCount !== 1 ? 's' : ''}`,
      changeUp: stats.overdueCount === 0,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'Invoices Sent',
      value: String(stats.totalCount),
      icon: FileText,
      change: `${stats.paidCount} collected`,
      changeUp: true,
      color: 'text-slate-900',
      bg: 'bg-slate-100',
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in pb-bottom-nav md:pb-10">
      {/* Header */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 mb-2">Command center</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{profile?.name || 'Your business'}</h1>
          <p className="text-sm text-slate-500 mt-1">Everything that needs your attention, in one place.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate({ name: 'voice' })} className="btn-secondary">
            <Mic className="w-4 h-4" />
            Voice Invoice
          </button>
          <button onClick={() => onNavigate({ name: 'editor' })} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Invoice
          </button>
        </div>
      </div>

      {/* Mobile hero — a fast, one-thumb starting point */}
      <section className="md:hidden relative overflow-hidden rounded-[1.75rem] p-5 mb-4 text-white premium-hero">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-indigo-400/30 blur-3xl" />
        <div className="absolute -left-16 -bottom-24 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-100">
              <Sparkles className="h-3 w-3" /> AI workspace
            </span>
          </div>
          <p className="text-sm text-indigo-100/75">Welcome back</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight truncate">{profile?.name || 'ThatInvoice'}</h1>
          <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-slate-300">Turn today’s work into money in under a minute.</p>
          <button
            onClick={() => onNavigate({ name: 'editor' })}
            className="mt-5 w-full min-touch rounded-2xl bg-white text-slate-950 font-bold py-3.5 px-4 flex items-center justify-center gap-2 shadow-xl shadow-black/20 active:scale-[0.98] transition-transform"
          >
            <Plus className="w-5 h-5" strokeWidth={2.7} />
            Create an invoice
          </button>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => onNavigate({ name: 'voice' })} className="min-touch rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2.5 text-xs font-semibold text-white backdrop-blur flex items-center justify-center gap-2 active:scale-[0.98]">
              <Mic className="w-4 h-4 text-cyan-300" /> Speak a job
            </button>
            <button onClick={() => onNavigate({ name: 'quick-invoice' })} className="min-touch rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2.5 text-xs font-semibold text-white backdrop-blur flex items-center justify-center gap-2 active:scale-[0.98]">
              <Zap className="w-4 h-4 text-amber-300" /> Quick invoice
            </button>
          </div>
        </div>
      </section>

      {/* Stat cards — 2x2 on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="card p-3.5 md:p-5 animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-2 md:mb-3">
                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-0.5 text-[10px] md:text-xs font-medium ${stat.changeUp ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {stat.changeUp ? <ArrowUpRight className="w-3 md:w-3.5 h-3 md:h-3.5" /> : <ArrowDownRight className="w-3 md:w-3.5 h-3 md:h-3.5" />}
                  <span className="hidden sm:inline">{stat.change}</span>
                </div>
              </div>
              <p className="text-lg md:text-2xl font-bold text-slate-900 tabular-nums">{stat.value}</p>
              <p className="text-xs md:text-sm text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 card p-4 md:p-6">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <div>
              <h2 className="font-semibold text-slate-900 text-sm md:text-base">Revenue Overview</h2>
              <p className="text-xs md:text-sm text-slate-500">Last 6 months</p>
            </div>
            <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500">
              <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
              Paid
            </div>
          </div>
          <div className="flex items-end justify-between gap-2 md:gap-3 h-32 md:h-48">
            {stats.months.map((month, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 md:gap-2 group">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative group-hover:scale-y-[1.02] origin-bottom"
                    style={{
                      height: `${(month.value / stats.maxMonth) * 100}%`,
                      minHeight: month.value > 0 ? '8px' : '2px',
                      background: month.value > 0
                        ? `linear-gradient(to top, ${accent}, ${accent}cc)`
                        : '#e2e8f0',
                    }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none">
                      {formatCurrency(month.value, symbol)}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] md:text-xs text-slate-400 font-medium">{month.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card p-4 md:p-6">
          <h2 className="font-semibold text-slate-900 text-sm md:text-base mb-1">Invoice Status</h2>
          <p className="text-xs md:text-sm text-slate-500 mb-4 md:mb-6">Current breakdown</p>
          <div className="space-y-3 md:space-y-4">
            {[
              { label: 'Paid', count: stats.paidCount, color: 'bg-emerald-500', text: 'text-emerald-600' },
              { label: 'Sent', count: stats.sentCount, color: 'bg-slate-500', text: 'text-slate-600' },
              { label: 'Overdue', count: stats.overdueCount, color: 'bg-red-500', text: 'text-red-600' },
              { label: 'Draft', count: stats.draftCount, color: 'bg-gray-400', text: 'text-gray-500' },
            ].map((status, i) => {
              const pct = stats.totalCount > 0 ? (status.count / stats.totalCount) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs md:text-sm text-slate-600">{status.label}</span>
                    <span className={`text-xs md:text-sm font-semibold ${status.text}`}>{status.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${status.color} rounded-full transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-slate-900" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-slate-700">
                  {stats.totalCount > 0 ? Math.round((stats.paidCount / stats.totalCount) * 100) : 0}% paid rate
                </p>
                <p className="text-[10px] md:text-xs text-slate-400">
                  {stats.paidCount} of {stats.totalCount} collected
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="card mt-4 md:mt-6 overflow-hidden">
        <div className="p-4 md:p-6 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm md:text-base">Recent Activity</h2>
          <button
            onClick={() => onNavigate({ name: 'invoices' })}
            className="text-xs md:text-sm text-slate-900 hover:text-black font-medium flex items-center gap-1"
          >
            View all
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="px-4 md:px-6 pb-8 md:pb-12 text-center">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 md:w-8 md:h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium text-sm md:text-base">No invoices yet</p>
            <p className="text-xs md:text-sm text-slate-400 mt-1">Create your first invoice to get started</p>
            <button onClick={() => onNavigate({ name: 'editor' })} className="btn-primary mt-4">
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y divide-slate-50">
              {recentInvoices.map(inv => {
                const sc = statusColor(inv.status);
                return (
                  <button
                    key={inv.id}
                    onClick={() => onNavigate({ name: 'preview', invoiceId: inv.id })}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-slate-50/50 active:bg-slate-50 transition-colors text-left min-touch"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 text-sm truncate">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{inv.client_name || 'No client'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`badge ${sc.bg} ${sc.text} text-[10px] py-0.5`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                        <span className="text-[10px] text-slate-400">{relativeTime(inv.created_at)}</span>
                      </div>
                    </div>
                    <span className="font-semibold text-slate-900 text-sm ml-3 shrink-0">{formatCurrency(inv.total, symbol)}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/50">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Invoice</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Client</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Date</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentInvoices.map(inv => {
                    const sc = statusColor(inv.status);
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => onNavigate({ name: 'preview', invoiceId: inv.id })}
                        className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-3.5">
                          <span className="font-medium text-slate-900 text-sm">{inv.invoice_number}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="text-sm text-slate-600">{inv.client_name || '—'}</span>
                        </td>
                        <td className="px-6 py-3.5 hidden lg:table-cell">
                          <span className="text-sm text-slate-500">{relativeTime(inv.created_at)}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`badge ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                          </span>
                          {inv.payment_status && inv.payment_status !== 'unpaid' && inv.payment_status !== 'paid' && (
                            <span className="block mt-1 text-[10px] font-medium text-amber-600">
                              {inv.payment_status === 'pending' ? 'Payment pending' : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <span className="font-semibold text-slate-900 text-sm">{formatCurrency(inv.total, symbol)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
