import { useState, useEffect, useCallback } from 'react';
import {
  Check, Loader2, ArrowLeft, CreditCard, Lock, Shield, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/format';
import { extractFunctionErrorMessage } from '@/lib/edgeFunctionError';

interface PublicInvoiceData {
  invoice: {
    id: string;
    invoice_number: string;
    client_name: string | null;
    client_email: string | null;
    total: number;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_amount: number;
    due_date: string | null;
    payment_status: string;
  };
  business: {
    name: string | null;
    logo_url: string | null;
    accent_color: string | null;
    currency_symbol: string | null;
    payments_enabled: boolean;
  };
  items: { description: string | null; quantity: number; total: number }[];
}

interface PayInvoiceProps {
  invoiceId: string;
}

export default function PayInvoice({ invoiceId }: PayInvoiceProps) {
  const [data, setData] = useState<PublicInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [paymentResult, setPaymentResult] = useState<'success' | 'cancelled' | null>(null);

  const loadInvoice = useCallback(async () => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-invoice?invoiceId=${encodeURIComponent(invoiceId)}`;
    const res = await fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    });
    const result = res.ok ? await res.json() : null;
    const fnError = res.ok ? null : new Error(`Request failed (${res.status})`);

    if (fnError || !result) {
      setError('Invoice not found or no longer available.');
      setLoading(false);
      return;
    }

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setData(result as PublicInvoiceData);
    setLoading(false);
  }, [invoiceId]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') setPaymentResult('success');
    if (status === 'cancelled') setPaymentResult('cancelled');
  }, []);

  const handlePay = async () => {
    if (!data) return;
    setRedirecting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: result, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { invoiceId: data.invoice.id },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (fnError) {
        const msg = result?.error || await extractFunctionErrorMessage(fnError, 'Failed to start payment.');
        throw new Error(msg);
      }
      if (result?.error) throw new Error(result.error);
      if (result?.url) {
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start payment. Please try again.';
      setError(message);
      setRedirecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Unable to load invoice</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { invoice, business, items } = data;
  const symbol = business.currency_symbol || '$';
  const accent = business.accent_color || '#111827';

  if (paymentResult === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center animate-scale-in">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <Check className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful</h1>
          <p className="text-sm text-slate-500 mb-1">
            Thank you! Your payment of <span className="font-semibold text-slate-700">{formatCurrency(invoice.total, symbol)}</span> for invoice <span className="font-semibold text-slate-700">{invoice.invoice_number}</span> has been received.
          </p>
          <p className="text-xs text-slate-400 mt-4">
            A confirmation will be sent to {invoice.client_email || 'your email'}.
          </p>
        </div>
      </div>
    );
  }

  const alreadyPaid = invoice.payment_status === 'paid';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-3 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {business.logo_url && (
              <img src={business.logo_url} alt="Logo" className="h-9 w-9 rounded-lg object-cover" />
            )}
            <div>
              <h1 className="font-bold text-slate-900 leading-tight">{business.name || 'Business'}</h1>
              <p className="text-xs text-slate-400">Invoice Payment</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            Secure Payment
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {paymentResult === 'cancelled' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm text-amber-700">
            <Clock className="w-4 h-4 flex-shrink-0" />
            Your payment was cancelled. You can try again below.
          </div>
        )}

        {alreadyPaid && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm text-emerald-700">
            <Check className="w-4 h-4 flex-shrink-0" />
            This invoice has already been paid. Thank you!
          </div>
        )}

        {/* Invoice summary card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 md:px-6 py-4 md:py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Invoice</p>
              <p className="text-lg font-bold text-slate-900">{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Due Date</p>
              <p className="text-sm font-medium text-slate-600">{invoice.due_date ? formatDate(invoice.due_date) : '—'}</p>
            </div>
          </div>

          {/* Bill to */}
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Bill To</p>
            <p className="font-semibold text-slate-900">{invoice.client_name || 'Customer'}</p>
            {invoice.client_email && <p className="text-sm text-slate-500">{invoice.client_email}</p>}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100">
              {/* Mobile card layout */}
              <div className="md:hidden space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{item.description || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-900 shrink-0">{formatCurrency(item.total, symbol)}</span>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <table className="w-full hidden md:table">
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 text-sm text-slate-700">{item.description || '—'}</td>
                      <td className="py-2.5 text-sm text-slate-500 text-right w-12">{item.quantity}</td>
                      <td className="py-2.5 text-sm font-medium text-slate-900 text-right w-24">{formatCurrency(item.total, symbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="px-4 md:px-6 py-4 md:py-5 bg-slate-50/50">
            <div className="flex justify-end">
              <div className="w-full md:w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-medium text-slate-900">{formatCurrency(invoice.subtotal, symbol)}</span>
                </div>
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tax ({invoice.tax_rate}%)</span>
                    <span className="font-medium text-slate-900">{formatCurrency(invoice.tax_amount, symbol)}</span>
                  </div>
                )}
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Discount</span>
                    <span className="font-medium text-red-600">−{formatCurrency(invoice.discount_amount, symbol)}</span>
                  </div>
                )}
                <div className="pt-3 border-t-2" style={{ borderColor: accent }}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-900">Total Due</span>
                    <span className="text-2xl font-bold" style={{ color: accent }}>
                      {formatCurrency(invoice.total, symbol)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment button */}
        {!alreadyPaid && (
          <div className="mt-6">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={redirecting || !business.payments_enabled}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-white text-lg transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg min-touch"
              style={{ background: accent, boxShadow: `0 4px 20px ${accent}40` }}
            >
              {redirecting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay {formatCurrency(invoice.total, symbol)}
                </>
              )}
            </button>
            {!business.payments_enabled && (
              <p className="text-center text-sm text-slate-400 mt-3">
                Online payments are not currently enabled for this business. Please contact them directly.
              </p>
            )}
            <p className="text-center text-xs text-slate-400 mt-4 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Secured by Stripe · Your card information is encrypted and never stored
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
