import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Send, Check, Mail, Printer, Pencil,
  CreditCard, Loader2, Plus, Trash2, Wallet, CheckCircle2,
  Share2, MoreHorizontal,
} from 'lucide-react';
import { useInvoices, useBusinessProfile, useInvoicePayments } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { hasFeature } from '@/lib/plans';
import { formatCurrency, formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { getIndustryTemplate } from '@/lib/industryTemplates';
import { extractFunctionErrorMessage } from '@/lib/edgeFunctionError';
import UpgradeModal from '@/views/UpgradeModal';
import DeliveryTimeline from '@/components/DeliveryTimeline';
import type { InvoiceStatus, PaymentMethod } from '@/lib/types';
import type { View } from '@/App';

interface InvoicePreviewProps {
  invoiceId: string;
  onNavigate: (view: View) => void;
}

export default function InvoicePreview({ invoiceId, onNavigate }: InvoicePreviewProps) {
  const { invoices, updateStatus, loading: invoicesLoading } = useInvoices();
  const { profile } = useBusinessProfile();
  const { tier } = useAuth();
  const symbol = profile?.currency_symbol || '$';
  const printRef = useRef<HTMLDivElement>(null);

  const invoice = invoices.find(inv => inv.id === invoiceId);
  const [showCopied, setShowCopied] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showPayCopied, setShowPayCopied] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canSendEmail = hasFeature(tier, 'emailSending');
  const canAcceptPayments = hasFeature(tier, 'directPayments');

  const [showMoreActions, setShowMoreActions] = useState(false);
  const { payments, addPayment, removePayment } = useInvoicePayments(invoice?.id);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const totalPaid = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const balanceDue = Math.max(0, (invoice?.total || 0) - totalPaid - (invoice?.deposit_amount || 0));

  useEffect(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    if (invoicesLoading || invoice) return;
    const timer = setTimeout(() => onNavigate({ name: 'invoices' }), 3000);
    redirectTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [invoice, invoicesLoading, onNavigate]);

  const handleSendEmail = async () => {
    if (!invoice) return;
    if (!invoice.client_email) {
      setEmailStatus('This invoice has no client email. Add one in the editor first.');
      setTimeout(() => setEmailStatus(null), 4000);
      return;
    }
    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: {
          to: invoice.client_email,
          invoiceId: invoice.id,
          invoice: {
            invoice_number: invoice.invoice_number,
            client_name: invoice.client_name,
            client_email: invoice.client_email,
            issue_date: formatDate(invoice.issue_date),
            due_date: formatDate(invoice.due_date),
            subtotal: invoice.subtotal,
            tax_rate: invoice.tax_rate,
            tax_amount: invoice.tax_amount,
            discount_amount: invoice.discount_amount,
            total: invoice.total,
            notes: invoice.notes,
          },
          business: profile,
          items: invoice.invoice_items || [],
          senderEmail: profile?.email,
        },
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (error) {
        const msg = data?.error || await extractFunctionErrorMessage(error, 'Unknown error');
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setEmailStatus(`Email sent to ${invoice.client_email}`);
      if (invoice.status === 'draft') updateStatus(invoice.id, 'sent');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setEmailStatus(`Failed to send: ${message}`);
    } finally {
      setSendingEmail(false);
      setTimeout(() => setEmailStatus(null), 5000);
    }
  };

  if (invoicesLoading || !invoice) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg mb-6" />
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 lg:p-12 space-y-6">
          <div className="flex justify-between">
            <div className="space-y-3">
              <div className="h-8 w-40 bg-slate-100 rounded-lg" />
              <div className="h-4 w-28 bg-slate-50 rounded" />
            </div>
            <div className="h-12 w-32 bg-slate-100 rounded-lg" />
          </div>
          <div className="h-4 w-20 bg-slate-100 rounded mt-8" />
          <div className="h-16 w-64 bg-slate-50 rounded-lg" />
          <div className="space-y-3 mt-8">
            <div className="h-10 bg-slate-50 rounded-lg" />
            <div className="h-10 bg-slate-50 rounded-lg" />
            <div className="h-10 bg-slate-50 rounded-lg" />
          </div>
          <div className="flex justify-end mt-6">
            <div className="h-24 w-72 bg-slate-50 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const items = invoice.invoice_items || [];
  const accent = profile?.accent_color || '#111827';
  const industryTemplate = getIndustryTemplate(invoice.industry_template);

  const handlePrint = () => window.print();

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleCopyPayLink = () => {
    const payUrl = `${window.location.origin}/pay/${invoice.id}`;
    navigator.clipboard.writeText(payUrl);
    setShowPayCopied(true);
    setTimeout(() => setShowPayCopied(false), 2000);
  };

  const statusOptions: InvoiceStatus[] = ['draft', 'sent', 'paid', 'overdue'];
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-slate-100 text-slate-700',
    paid: 'bg-emerald-50 text-emerald-700',
    overdue: 'bg-red-50 text-red-700',
  };

  const paymentBadge: Record<string, { label: string; class: string }> = {
    unpaid: { label: 'Unpaid', class: 'bg-slate-100 text-slate-500' },
    pending: { label: 'Payment Pending', class: 'bg-amber-50 text-amber-700' },
    partial: { label: 'Partial Payment', class: 'bg-blue-50 text-blue-700' },
    paid: { label: 'Paid Online', class: 'bg-emerald-50 text-emerald-700' },
  };

  const isEstimate = invoice.document_type === 'estimate';

  return (
    <div className="animate-fade-in">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => onNavigate({ name: 'invoices' })} className="btn-ghost px-2.5 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-900 truncate">{invoice.invoice_number}</h1>
              <p className="text-xs text-slate-500 truncate">{invoice.client_name || 'No client'}</p>
            </div>
            <span className={`badge ${statusColors[invoice.status]} flex-shrink-0`}>
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
            {invoice.payment_status && invoice.payment_status !== 'unpaid' && (
              <span className={`badge ${paymentBadge[invoice.payment_status]?.class || ''} flex-shrink-0`}>
                {paymentBadge[invoice.payment_status]?.label || invoice.payment_status}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <select
                value={invoice.status}
                onChange={e => updateStatus(invoice.id, e.target.value as InvoiceStatus)}
                className="btn-secondary text-sm py-2 pr-8 appearance-none cursor-pointer"
              >
                {statusOptions.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <button onClick={handleCopyLink} className="btn-secondary">
              {showCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">{showCopied ? 'Copied!' : 'Copy link'}</span>
            </button>
            {canAcceptPayments && profile?.payments_enabled && invoice.payment_status !== 'paid' && (
              <button onClick={handleCopyPayLink} className="btn-secondary">
                {showPayCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <CreditCard className="w-4 h-4" />}
                <span className="hidden sm:inline">{showPayCopied ? 'Copied!' : 'Pay link'}</span>
              </button>
            )}
            <button
              onClick={() => {
                if (canSendEmail) handleSendEmail();
                else setShowUpgrade(true);
              }}
              className="btn-secondary"
            >
              {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              <span className="hidden sm:inline">{sendingEmail ? 'Sending...' : 'Email'}</span>
            </button>
            <button onClick={() => onNavigate({ name: 'editor', invoiceId: invoice.id })} className="btn-secondary">
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button onClick={handlePrint} className="btn-primary" style={{ background: accent }}>
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
          </div>
        </div>
        {emailStatus && (
          <div className={`px-4 sm:px-6 py-2 text-sm border-t animate-fade-in ${
            emailStatus.startsWith('Failed') || emailStatus.startsWith('This invoice')
              ? 'bg-red-50 text-red-600 border-red-100'
              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
          }`}>
            {emailStatus}
          </div>
        )}
      </div>

      {/* Mobile action bar */}
      <div className="md:hidden no-print sticky top-0 z-30 bg-white border-b border-slate-200 safe-area-pt">
        <div className="flex items-center gap-1 px-3 h-14">
          <button onClick={() => onNavigate({ name: 'invoices' })} className="p-2 text-slate-600 shrink-0 min-touch">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 text-sm truncate">{invoice.invoice_number}</p>
            <p className="text-xs text-slate-500 truncate">{invoice.client_name || 'No client'}</p>
          </div>
          <button
            onClick={() => {
              if (canSendEmail) handleSendEmail();
              else setShowUpgrade(true);
            }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-white shrink-0 min-touch"
            style={{ background: accent }}
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
          <button
            onClick={() => setShowMoreActions(true)}
            className="p-2 text-slate-600 shrink-0 min-touch"
            aria-label="More actions"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
        {emailStatus && (
          <div className={`px-3 py-2 text-xs border-t animate-fade-in ${
            emailStatus.startsWith('Failed') || emailStatus.startsWith('This invoice')
              ? 'bg-red-50 text-red-600 border-red-100'
              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
          }`}>
            {emailStatus}
          </div>
        )}
      </div>

      {/* Mobile more actions bottom sheet */}
      {showMoreActions && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm animate-overlay"
            onClick={() => setShowMoreActions(false)}
          />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl animate-sheet-in safe-area-pb max-h-[80vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
            </div>
            <div className="px-5 pt-2 pb-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">Actions</h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => { handleCopyLink(); setShowMoreActions(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left min-touch"
                >
                  <Share2 className="w-5 h-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">{showCopied ? 'Link copied!' : 'Share link'}</span>
                </button>
                <button
                  onClick={() => { handlePrint(); setShowMoreActions(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left min-touch"
                >
                  <Printer className="w-5 h-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Print / Download PDF</span>
                </button>
                {canAcceptPayments && profile?.payments_enabled && invoice.payment_status !== 'paid' && (
                  <button
                    onClick={() => { handleCopyPayLink(); setShowMoreActions(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left min-touch"
                  >
                    <CreditCard className="w-5 h-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{showPayCopied ? 'Pay link copied!' : 'Copy payment link'}</span>
                  </button>
                )}
                <button
                  onClick={() => { onNavigate({ name: 'editor', invoiceId: invoice.id }); setShowMoreActions(false); }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left min-touch"
                >
                  <Pencil className="w-5 h-5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Edit invoice</span>
                </button>
                {!isEstimate && balanceDue > 0 && (
                  <button
                    onClick={() => { setShowPaymentModal(true); setShowMoreActions(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left min-touch"
                  >
                    <Wallet className="w-5 h-5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">Record payment</span>
                  </button>
                )}
                <div className="pt-2 mt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-3">Status</p>
                  <div className="flex gap-2 px-3">
                    {statusOptions.map(s => (
                      <button
                        key={s}
                        onClick={() => { updateStatus(invoice.id, s); setShowMoreActions(false); }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium min-touch ${
                          invoice.status === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-10">
        <div ref={printRef} className="print-area bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 lg:p-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 mb-10 sm:mb-12">
            <div>
              {profile?.logo_url && (
                <img src={profile.logo_url} alt="Logo" className="h-12 mb-4" />
              )}
              <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: accent }}>
                {profile?.name || 'My Business'}
              </h1>
              {profile?.address && <p className="text-sm text-slate-500 mt-1 whitespace-pre-line">{profile.address}</p>}
              {profile?.email && <p className="text-sm text-slate-500">{profile.email}</p>}
              {profile?.phone && <p className="text-sm text-slate-500">{profile.phone}</p>}
            </div>
            <div className="text-left sm:text-right">
              <div
                className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight mb-2"
                style={{ letterSpacing: '-0.05em' }}
              >
                {isEstimate ? 'ESTIMATE' : 'INVOICE'}
              </div>
              <p className="text-sm font-medium text-slate-700">{isEstimate ? (invoice.estimate_number || invoice.invoice_number) : invoice.invoice_number}</p>
              <div className="mt-4 space-y-1">
                <p className="text-xs text-slate-400">Issued: <span className="text-slate-600 font-medium">{formatDate(invoice.issue_date)}</span></p>
                <p className="text-xs text-slate-400">Due: <span className="text-slate-600 font-medium">{formatDate(invoice.due_date)}</span></p>
              </div>
            </div>
          </div>

          {/* Bill to */}
          <div className="mb-10">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Bill To</p>
            <p className="text-lg font-semibold text-slate-900">{invoice.client_name || '—'}</p>
            {invoice.client_phone && <p className="text-sm text-slate-500">{invoice.client_phone}</p>}
            {invoice.client_email && <p className="text-sm text-slate-500">{invoice.client_email}</p>}
            {invoice.client_address && <p className="text-sm text-slate-500 whitespace-pre-line">{invoice.client_address}</p>}
          </div>

          {/* Job details */}
          {(invoice.work_order_number || invoice.technician_name) && (
            <div className="mb-10 grid grid-cols-2 gap-6">
              {invoice.work_order_number && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{industryTemplate.detailLabels.workOrder || 'Work Order'}</p>
                  <p className="text-sm font-medium text-slate-700">{invoice.work_order_number}</p>
                </div>
              )}
              {invoice.technician_name && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{industryTemplate.detailLabels.technician || 'Technician'}</p>
                  <p className="text-sm font-medium text-slate-700">{invoice.technician_name}</p>
                </div>
              )}
            </div>
          )}

          {/* Industry-specific custom fields */}
          {invoice.metadata && industryTemplate.customFields.length > 0 && (
            <div className="mb-10">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {industryTemplate.label} Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {industryTemplate.customFields.map(field => {
                  const val = invoice.metadata?.[field.key];
                  if (!val) return null;
                  return (
                    <div key={field.key} className={field.full ? 'sm:col-span-2' : ''}>
                      <p className="text-xs text-slate-400">{field.label}</p>
                      <p className="text-sm font-medium text-slate-700">{val}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items table */}
          <div className="mb-8 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2" style={{ borderColor: accent }}>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider py-3 text-slate-500">Description</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider py-3 text-slate-500 w-20">Qty</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider py-3 text-slate-500 w-32">Unit Price</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider py-3 text-slate-500 w-32">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-3.5 text-sm text-slate-700">
                      {item.description || '—'}
                      {item.notes && (
                        <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>
                      )}
                    </td>
                    <td className="py-3.5 text-sm text-slate-600 text-right whitespace-nowrap">
                      {item.quantity}
                      <span className="text-slate-400 text-xs ml-0.5">{item.unit || 'ea'}</span>
                    </td>
                    <td className="py-3.5 text-sm text-slate-600 text-right">{formatCurrency(item.unit_price, symbol)}</td>
                    <td className="py-3.5 text-sm font-medium text-slate-900 text-right">
                      {formatCurrency(item.total, symbol)}
                      {item.discount_amount > 0 && (
                        <p className="text-[10px] text-slate-400">−{item.discount_amount}% disc.</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-10">
            <div className="w-72 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCurrency(invoice.subtotal, symbol)}</span>
              </div>
              {invoice.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount ({invoice.discount_amount}%)</span>
                  <span className="font-medium text-red-600">−{formatCurrency(invoice.subtotal * invoice.discount_amount / 100, symbol)}</span>
                </div>
              )}
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Tax ({invoice.tax_rate}%)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(invoice.tax_amount, symbol)}</span>
                </div>
              )}
              {invoice.fees_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Fees</span>
                  <span className="font-medium text-slate-900">{formatCurrency(invoice.fees_amount, symbol)}</span>
                </div>
              )}
              {invoice.shipping_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Shipping</span>
                  <span className="font-medium text-slate-900">{formatCurrency(invoice.shipping_amount, symbol)}</span>
                </div>
              )}
              <div className="pt-3 border-t-2" style={{ borderColor: accent }}>
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="text-2xl font-bold" style={{ color: accent }}>
                    {formatCurrency(invoice.total, symbol)}
                  </span>
                </div>
              </div>
              {invoice.deposit_amount > 0 && (
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-slate-500">Deposit</span>
                  <span className="font-medium text-emerald-600">−{formatCurrency(invoice.deposit_amount, symbol)}</span>
                </div>
              )}
              {totalPaid > 0 && (
                <div className="flex justify-between text-sm pt-2">
                  <span className="text-slate-500">Payments received</span>
                  <span className="font-medium text-emerald-600">−{formatCurrency(totalPaid, symbol)}</span>
                </div>
              )}
              {(invoice.deposit_amount > 0 || totalPaid > 0) && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Balance Due</span>
                  <span className="text-lg font-bold text-slate-900">{formatCurrency(balanceDue, symbol)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Work Done, Terms & Warranty */}
          {(invoice.notes || invoice.terms || invoice.warranty) && (
            <div className="border-t border-slate-100 pt-6 space-y-4">
              {invoice.notes && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{industryTemplate.detailLabels.notes || 'Work Done'}</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
              {invoice.warranty && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{industryTemplate.detailLabels.warranty || 'Warranty'}</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.warranty}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{industryTemplate.detailLabels.terms || 'Terms & Conditions'}</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm font-medium text-slate-600">
              Thank you for your business!
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {profile?.name || 'My Business'} · {profile?.email || ''}
            </p>
          </div>
        </div>

        {/* Delivery & open status — not printable */}
        {!isEstimate && (
          <div className="no-print mt-6 card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Delivery status</h2>
            <DeliveryTimeline invoice={invoice} />
          </div>
        )}

        {/* Partial Payments panel — not printable */}
        {!isEstimate && (
          <div className="no-print mt-6 card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-slate-400" />
                <h2 className="font-semibold text-slate-900">Payments</h2>
                {totalPaid > 0 && (
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {formatCurrency(totalPaid, symbol)} of {formatCurrency(invoice.total, symbol)}
                  </span>
                )}
              </div>
              {balanceDue > 0 && (
                <button onClick={() => setShowPaymentModal(true)} className="btn-secondary text-sm">
                  <Plus className="w-4 h-4" />
                  Record Payment
                </button>
              )}
            </div>
            {payments && payments.length > 0 ? (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(p.amount, symbol)}</p>
                        <p className="text-xs text-slate-400 capitalize">{p.method}{p.reference ? ` · ${p.reference}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{formatDate(p.paid_at)}</span>
                      <button onClick={() => removePayment(p.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {balanceDue > 0 ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <span className="text-sm text-amber-700 font-medium">Remaining balance</span>
                    <span className="text-sm font-bold text-amber-700">{formatCurrency(balanceDue, symbol)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700 font-medium">Fully paid</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-slate-400">No payments recorded yet</p>
                <p className="text-xs text-slate-300 mt-0.5">Record cash, check, or online payments to track balances</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Payment recording modal */}
      {showPaymentModal && (
        <PaymentModal
          symbol={symbol}
          accent={accent}
          maxAmount={balanceDue}
          onClose={() => setShowPaymentModal(false)}
          onSave={async (amount, method, reference) => {
            await addPayment(amount, method, reference);
            setShowPaymentModal(false);
          }}
        />
      )}

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature="Sending invoices by email" />
    </div>
  );
}

function PaymentModal({
  symbol, accent, maxAmount, onClose, onSave,
}: {
  symbol: string;
  accent: string;
  maxAmount: number;
  onClose: () => void;
  onSave: (amount: number, method: PaymentMethod, reference?: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(maxAmount.toString());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    setSaving(true);
    await onSave(amt, method, reference.trim() || undefined);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Record Payment</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 rotate-45" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{symbol}</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="0"
                max={maxAmount}
                step="0.01"
                className="input pl-7"
                autoFocus
              />
            </div>
            <button onClick={() => setAmount(maxAmount.toFixed(2))} className="text-xs text-slate-400 hover:text-slate-600 mt-1">Full balance ({formatCurrencySafe(maxAmount, symbol)})</button>
          </div>
          <div>
            <label className="label">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value as PaymentMethod)} className="input cursor-pointer">
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank">Bank transfer</option>
              <option value="stripe">Stripe (online)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Reference (optional)</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Check #, transaction ID…"
              className="input"
            />
          </div>
        </div>
        <div className="flex gap-3 p-6 pt-4 border-t border-slate-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!amount || saving}
            className="flex-1 btn-primary disabled:opacity-50"
            style={{ background: accent }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCurrencySafe(n: number, symbol: string) {
  return `${symbol}${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
