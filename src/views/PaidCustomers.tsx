import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Search, DollarSign, Users, AlertTriangle, XCircle,
  Loader2, CreditCard, Crown, Shield, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { PaidCustomerRow, PaidCustomersResponse } from '@/lib/paidCustomers';
import { formatCurrency, formatDate } from '@/lib/format';

type StatusFilter = 'all' | 'paid' | 'active' | 'past_due' | 'canceled' | 'incomplete';

interface PaidCustomersProps {
  accentColor?: string;
}

export default function PaidCustomers({ accentColor = '#111827' }: PaidCustomersProps) {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<PaidCustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke<PaidCustomersResponse & { error?: string }>(
        'admin-paid-customers',
        { method: 'GET' },
      );

      if (fnError) {
        setError(fnError.message || 'Failed to load paid customers.');
        return;
      }
      if (result?.error) {
        setError(result.error);
        return;
      }
      setData(result ?? null);
    } catch {
      setError('An unexpected error occurred while fetching data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchData();
    else setLoading(false);
  }, [isAdmin, fetchData]);

  const filteredCustomers = useMemo(() => {
    if (!data?.customers) return [];
    return data.customers.filter((c) => {
      const matchesSearch =
        !search ||
        (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (c.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
        c.plan.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'paid') return c.is_actually_paid;
      if (statusFilter === 'active') return c.subscription_status === 'active';
      if (statusFilter === 'past_due') return c.subscription_status === 'past_due';
      if (statusFilter === 'canceled') return c.subscription_status === 'canceled';
      if (statusFilter === 'incomplete')
        return c.subscription_status === 'incomplete' || c.subscription_status === 'incomplete_expired';
      return true;
    });
  }, [data, search, statusFilter]);

  // Guard: non-admin users should never see this page
  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="card p-10 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Admin Access Required</h2>
          <p className="text-sm text-slate-500">
            This page is restricted to administrators. If you believe you should have access, contact your account manager.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto animate-pulse">
        <div className="h-8 w-48 bg-slate-200 rounded-lg mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-5">
              <div className="h-4 w-24 bg-slate-100 rounded mb-3" />
              <div className="h-8 w-32 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="card p-6">
          <div className="h-10 w-full bg-slate-100 rounded-xl mb-4" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-50 rounded-xl mb-2" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <div className="card p-10 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Couldn't Load Data</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => fetchData()}
            className="btn-secondary"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const mrr = summary?.monthly_recurring_revenue ?? 0;
  const mrrCurrency = summary?.currency ?? 'usd';
  const currencySymbol = mrrCurrency === 'usd' ? '$' : mrrCurrency === 'eur' ? '€' : mrrCurrency === 'gbp' ? '£' : '$';

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-5xl mx-auto animate-fade-in pb-bottom-nav md:pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Crown className="w-5 h-5 md:w-6 md:h-6" style={{ color: accentColor }} />
            Paid Customers
          </h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Stripe
            </span>
            <span>· Read-only · No modifications</span>
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="btn-secondary min-touch"
          aria-label="Refresh data"
        >
          {refreshing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4 mb-4 md:mb-6">
        <SummaryCard
          icon={<Users className="w-5 h-5" />}
          label="Actually Paid"
          value={summary?.actually_paid ?? 0}
          color="emerald"
        />
        <SummaryCard
          icon={<DollarSign className="w-5 h-5" />}
          label="MRR"
          value={formatCurrency(mrr / 100, currencySymbol)}
          color="slate"
        />
        <SummaryCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Past Due / Failed"
          value={(summary?.past_due ?? 0) + (summary?.incomplete ?? 0)}
          color="amber"
        />
        <SummaryCard
          icon={<XCircle className="w-5 h-5" />}
          label="Canceled"
          value={summary?.canceled ?? 0}
          color="red"
        />
      </div>

      {/* Search + filter bar */}
      <div className="card p-3 md:p-4 mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, name, or plan..."
              className="input pl-10 min-touch"
              aria-label="Search customers"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'paid', 'active', 'past_due', 'canceled', 'incomplete'] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-touch ${
                  statusFilter === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? 'All' : f === 'past_due' ? 'Past Due' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table or empty state */}
      {filteredCustomers.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600 mb-1">No customers found</p>
          <p className="text-xs text-slate-400">
            {data?.customers?.length
              ? 'Try adjusting your search or filter.'
              : 'No paid subscriptions exist in Stripe yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Customer</th>
                    <th className="text-left px-5 py-3 font-medium">Plan</th>
                    <th className="text-right px-5 py-3 font-medium">Paid</th>
                    <th className="text-left px-5 py-3 font-medium">Payment</th>
                    <th className="text-left px-5 py-3 font-medium">Sub Status</th>
                    <th className="text-left px-5 py-3 font-medium">Paid Date</th>
                    <th className="text-left px-5 py-3 font-medium">Renewal</th>
                    <th className="text-left px-5 py-3 font-medium">Card</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.stripe_subscription_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900 truncate max-w-[200px]">{c.email ?? '—'}</div>
                        {c.name && <div className="text-xs text-slate-400 truncate max-w-[200px]">{c.name}</div>}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-slate-700">{c.plan}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {c.is_actually_paid ? (
                          <span className="font-semibold text-emerald-600">
                            {formatCurrency(c.amount_paid / 100, c.currency === 'usd' ? '$' : '')}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <PaymentBadge status={c.latest_invoice_status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <SubStatusBadge status={c.subscription_status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {formatDate(c.paid_date)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {formatDate(c.next_renewal_date)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {c.card_brand ? (
                          <span className="inline-flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            <span className="capitalize">{c.card_brand}</span>
                            {c.card_last4 && <span className="text-slate-400">•••• {c.card_last4}</span>}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredCustomers.map((c) => (
              <div key={c.stripe_subscription_id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{c.email ?? '—'}</p>
                    {c.name && <p className="text-xs text-slate-400 truncate">{c.name}</p>}
                  </div>
                  <SubStatusBadge status={c.subscription_status} />
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Plan</p>
                    <p className="font-medium text-slate-700">{c.plan}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Paid</p>
                    {c.is_actually_paid ? (
                      <p className="font-semibold text-emerald-600">
                        {formatCurrency(c.amount_paid / 100, c.currency === 'usd' ? '$' : '')}
                      </p>
                    ) : <p className="text-slate-400">—</p>}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Payment</p>
                    <PaymentBadge status={c.latest_invoice_status} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Card</p>
                    <p className="text-slate-600">
                      {c.card_brand ? `${c.card_brand} •••• ${c.card_last4 ?? ''}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Paid Date</p>
                    <p className="text-slate-600">{formatDate(c.paid_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Renewal</p>
                    <p className="text-slate-600">{formatDate(c.next_renewal_date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer note */}
      <p className="text-xs text-slate-400 text-center mt-4">
        Showing {filteredCustomers.length} of {data?.customers?.length ?? 0} customers · Data from live Stripe API · Read-only
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'emerald' | 'slate' | 'amber' | 'red';
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

function PaymentBadge({ status }: { status: string | null }) {
  if (status === 'paid') {
    return <span className="badge bg-emerald-50 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Paid</span>;
  }
  if (status === 'open') {
    return <span className="badge bg-slate-100 text-slate-600"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Open</span>;
  }
  if (status === 'void') {
    return <span className="badge bg-slate-100 text-slate-500"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Void</span>;
  }
  if (status === 'uncollectible') {
    return <span className="badge bg-red-50 text-red-600"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />Failed</span>;
  }
  return <span className="text-slate-400 text-xs">—</span>;
}

function SubStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    trialing: 'bg-blue-50 text-blue-700',
    past_due: 'bg-amber-50 text-amber-700',
    canceled: 'bg-red-50 text-red-600',
    incomplete: 'bg-slate-100 text-slate-500',
    incomplete_expired: 'bg-slate-100 text-slate-400',
    unpaid: 'bg-red-50 text-red-600',
  };
  const label = status === 'incomplete_expired' ? 'Incomplete' : status.replace('_', ' ');
  const cls = styles[status] ?? 'bg-slate-100 text-slate-500';
  return (
    <span className={`badge ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}
