import { useState, useMemo } from 'react';
import {
  TrendingUp, DollarSign, Clock, CheckCircle2, Download,
  ArrowUpRight, ArrowDownRight,
  AlertCircle, RefreshCw, Users,
} from 'lucide-react';
import { useInvoices, useExpenses, useBusinessProfile } from '@/lib/hooks';
import { formatCurrency } from '@/lib/format';
import { computeReportMetrics, computeClientSummary } from '@/lib/reports';
import type { View } from '@/App';

interface ReportsProps {
  onNavigate: (view: View) => void;
}

type Range = '30' | '90' | '365' | 'all';

export default function Reports(_props: ReportsProps) {
  void _props;
  const { invoices } = useInvoices();
  const { expenses } = useExpenses();
  const { profile } = useBusinessProfile();
  const symbol = profile?.currency_symbol || '$';
  const accent = profile?.accent_color || '#111827';
  const [range, setRange] = useState<Range>('90');

  const cutoffDate = useMemo(() => {
    if (range === 'all') return new Date(0);
    const days = parseInt(range);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }, [range]);

  const data = useMemo(() => {
    const inRange = (dateStr: string) => new Date(dateStr) >= cutoffDate;
    const rangeInvoices = invoices.filter(i => inRange(i.issue_date));
    const rangeExpenses = expenses.filter(e => inRange(e.expense_date));

    const paid = rangeInvoices.filter(i => i.status === 'paid');
    const sent = rangeInvoices.filter(i => i.status === 'sent');
    const overdue = rangeInvoices.filter(i => i.status === 'overdue');

    const revenue = paid.reduce((s, i) => s + (i.total || 0), 0);
    const outstanding = sent.reduce((s, i) => s + (i.total || 0), 0) + overdue.reduce((s, i) => s + (i.total || 0), 0);
    const overdueAmount = overdue.reduce((s, i) => s + (i.total || 0), 0);
    const totalExpenses = rangeExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const netProfit = revenue - totalExpenses;

    // Top clients by revenue
    const clientMap: Record<string, { name: string; revenue: number; count: number }> = {};
    paid.forEach(inv => {
      const name = inv.client_name || 'Unknown';
      if (!clientMap[name]) clientMap[name] = { name, revenue: 0, count: 0 };
      clientMap[name].revenue += inv.total || 0;
      clientMap[name].count += 1;
    });
    const topClients = Object.values(clientMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Monthly breakdown
    const months: { label: string; revenue: number; expenses: number }[] = [];
    const now = new Date();
    const monthsToShow = range === '30' ? 1 : range === '90' ? 3 : range === '365' ? 12 : 6;
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const mRev = paid.filter(inv => { const d = new Date(inv.issue_date); return d >= mStart && d <= mEnd; }).reduce((s, inv) => s + (inv.total || 0), 0);
      const mExp = rangeExpenses.filter(exp => { const d = new Date(exp.expense_date); return d >= mStart && d <= mEnd; }).reduce((s, exp) => s + (exp.amount || 0), 0);
      months.push({ label: mStart.toLocaleDateString('en-US', { month: 'short' }), revenue: mRev, expenses: mExp });
    }
    const maxMonthVal = Math.max(...months.map(m => Math.max(m.revenue, m.expenses)), 1);

    // Payment status breakdown
    const statusCounts = {
      paid: paid.length,
      sent: sent.length,
      overdue: overdue.length,
      draft: rangeInvoices.filter(i => i.status === 'draft').length,
    };
    const totalInvoices = rangeInvoices.length;
    const collectionRate = totalInvoices > 0 ? Math.round((paid.length / totalInvoices) * 100) : 0;

    // Enhanced metrics from reports.ts — real data only
    const reportMetrics = computeReportMetrics(invoices);
    const clientSummaries = computeClientSummary(invoices).slice(0, 5);

    return {
      revenue, outstanding, overdueAmount, totalExpenses, netProfit,
      topClients, months, maxMonthVal, statusCounts, totalInvoices,
      collectionRate, paidCount: paid.length, overdueCount: overdue.length,
      avgTimeToPay: reportMetrics.avgTimeToPay,
      estimateConversionRate: reportMetrics.estimateConversionRate,
      estimatesCount: reportMetrics.estimatesCount,
      clientSummaries,
    };
  }, [invoices, expenses, cutoffDate, range]);

  const handleExport = () => {
    const rows = [
      ['Type', 'Number', 'Client', 'Date', 'Status', 'Amount'],
      ...invoices.map(i => ['Invoice', i.invoice_number, i.client_name || '', i.issue_date, i.status, i.total?.toString() || '0']),
      ...expenses.map(e => ['Expense', '', e.vendor || '', e.expense_date, e.category, e.amount?.toString() || '0']),
    ];
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: 'Revenue', value: formatCurrency(data.revenue, symbol), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', up: true },
    { label: 'Outstanding', value: formatCurrency(data.outstanding, symbol), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', up: false },
    { label: 'Overdue', value: formatCurrency(data.overdueAmount, symbol), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', up: false },
    { label: 'Net Profit', value: formatCurrency(data.netProfit, symbol), icon: TrendingUp, color: data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600', bg: data.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50', up: data.netProfit >= 0 },
  ];

  const insightCards = [
    { label: 'Avg. time to pay', value: data.avgTimeToPay !== null ? `${data.avgTimeToPay} days` : '—', icon: Clock, subtitle: data.avgTimeToPay !== null ? 'From creation to payment' : 'No paid invoices yet' },
    { label: 'Estimate conversion', value: `${data.estimateConversionRate}%`, icon: RefreshCw, subtitle: `${data.estimatesCount} estimates` },
    { label: 'Collection rate', value: `${data.collectionRate}%`, icon: CheckCircle2, subtitle: `${data.paidCount} of ${data.totalInvoices} paid` },
    { label: 'Overdue invoices', value: `${data.overdueCount}`, icon: AlertCircle, subtitle: data.overdueCount > 0 ? 'Needs attention' : 'All current' },
  ];

  const rangeOptions: { value: Range; label: string }[] = [
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
    { value: '365', label: '1 year' },
    { value: 'all', label: 'All time' },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in pb-bottom-nav md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500 mt-1 hidden sm:block">Sales, payments, and profit analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-slate-200 rounded-xl p-1 bg-slate-50">
            {rangeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${range === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="card p-5 animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className={`flex items-center gap-0.5 text-xs ${stat.up ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {stat.up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Insight cards — avg time to pay, conversion, overdue */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3 mb-4 md:mb-6">
        {insightCards.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <div key={i} className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-slate-400" />
                <p className="text-xs font-medium text-slate-500">{insight.label}</p>
              </div>
              <p className="text-xl font-bold text-slate-900">{insight.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{insight.subtitle}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        {/* Revenue vs Expenses chart */}
        <div className="lg:col-span-2 card p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-semibold text-slate-900">Revenue vs Expenses</h2>
              <p className="text-sm text-slate-500">Monthly comparison</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
                <span className="text-slate-500">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="text-slate-500">Expenses</span>
              </div>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 h-48">
            {data.months.map((month, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full flex-1 flex items-end justify-center gap-1">
                  <div className="w-1/2 flex items-end">
                    <div
                      className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative"
                      style={{
                        height: `${(month.revenue / data.maxMonthVal) * 100}%`,
                        minHeight: month.revenue > 0 ? '8px' : '2px',
                        background: month.revenue > 0 ? accent : '#e2e8f0',
                      }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none">
                        {formatCurrency(month.revenue, symbol)}
                      </div>
                    </div>
                  </div>
                  <div className="w-1/2 flex items-end">
                    <div
                      className="w-full rounded-t-lg transition-all duration-500 hover:opacity-80 relative"
                      style={{
                        height: `${(month.expenses / data.maxMonthVal) * 100}%`,
                        minHeight: month.expenses > 0 ? '8px' : '2px',
                        background: month.expenses > 0 ? '#f87171' : '#e2e8f0',
                      }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none">
                        {formatCurrency(month.expenses, symbol)}
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-medium">{month.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Collection rate */}
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Collection Rate</h2>
          <p className="text-sm text-slate-500 mb-6">Invoices paid on time</p>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none" stroke={accent} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(data.collectionRate / 100) * 251.2} 251.2`}
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-slate-900">{data.collectionRate}%</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-4 text-center">
              {data.paidCount} of {data.totalInvoices} invoices paid
            </p>
          </div>
          <div className="mt-6 pt-6 border-t border-slate-100 space-y-3">
            {[
              { label: 'Paid', count: data.statusCounts.paid, color: 'bg-emerald-500' },
              { label: 'Sent', count: data.statusCounts.sent, color: 'bg-slate-500' },
              { label: 'Overdue', count: data.statusCounts.overdue, color: 'bg-red-500' },
              { label: 'Draft', count: data.statusCounts.draft, color: 'bg-gray-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <span className="text-sm text-slate-600">{s.label}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top clients — with outstanding amounts */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-slate-900">Top Clients by Revenue</h2>
            <p className="text-sm text-slate-500">Highest paying customers with outstanding balances</p>
          </div>
          <Users className="w-5 h-5 text-slate-300" />
        </div>
        {data.clientSummaries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 font-medium">No invoices yet</p>
            <p className="text-sm text-slate-400 mt-1">Create and send invoices to see client analytics</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.clientSummaries.map((client, i) => {
              const maxBilled = data.clientSummaries[0]?.totalBilled || 1;
              const pct = (client.totalBilled / maxBilled) * 100;
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: accent }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-900 truncate">{client.clientName}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {client.outstanding > 0 && (
                          <span className="text-xs font-medium text-amber-600">{formatCurrency(client.outstanding, symbol)} owed</span>
                        )}
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(client.totalPaid, symbol)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: accent }} />
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{client.invoiceCount} inv</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
