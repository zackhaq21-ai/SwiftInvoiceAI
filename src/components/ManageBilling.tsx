import { useState, useCallback } from 'react';
import {
  Crown, AlertTriangle, Loader2, Check, X,
  Calendar, RefreshCw, Shield, CreditCard, Clock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import {
  getCancellationEligibility,
  formatPeriodEnd,
  isCancellationPending,
} from '@/lib/cancellation';


interface ManageBillingProps {
  accentColor?: string;
}

export default function ManageBilling({ accentColor = '#111827' }: ManageBillingProps) {
  const { tier, subscription, refreshTier } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmStep, setConfirmStep] = useState<'explain' | 'final'>('explain');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resumeProcessing, setResumeProcessing] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const eligibility = getCancellationEligibility(
    tier,
    subscription?.cancel_at_period_end ?? false,
    subscription?.status ?? null,
  );

  const planInfo = PLANS[tier as keyof typeof PLANS];
  const periodEndFormatted = formatPeriodEnd(subscription?.current_period_end ?? null);
  const cancellationPending = isCancellationPending(subscription);
  const isPaidTier = ['pro', 'business', 'enterprise'].includes(tier);
  const isLoading = !subscription && isPaidTier;

  const handleCancelClick = useCallback(() => {
    setError(null);
    setSuccess(null);
    setConfirmStep('explain');
    setShowConfirm(true);
  }, []);

  const handleConfirmFirst = useCallback(() => {
    setConfirmStep('final');
  }, []);

  const handleConfirmFinal = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'cancel' },
      });

      if (fnError) {
        setError(fnError.message || 'Failed to cancel subscription. Please try again.');
        return;
      }
      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuccess('Your subscription will remain active until the end of your current billing period.');
      setShowConfirm(false);
      await refreshTier();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  }, [processing, refreshTier]);

  const handleResume = useCallback(async () => {
    if (resumeProcessing) return;
    setResumeProcessing(true);
    setResumeError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'resume' },
      });

      if (fnError) {
        setResumeError(fnError.message || 'Failed to resume subscription. Please try again.');
        return;
      }
      if (data?.error) {
        setResumeError(data.error);
        return;
      }

      setSuccess('Your subscription has been resumed. Cancellation cancelled.');
      await refreshTier();
    } catch {
      setResumeError('An unexpected error occurred. Please try again.');
    } finally {
      setResumeProcessing(false);
    }
  }, [resumeProcessing, refreshTier]);

  const closeModal = useCallback(() => {
    if (processing) return;
    setShowConfirm(false);
    setConfirmStep('explain');
    setError(null);
  }, [processing]);

  // Loading state — subscription details still being fetched
  if (isLoading) {
    return (
      <div className="card p-6 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-slate-200" />
          <div className="flex-1">
            <div className="h-5 w-32 bg-slate-200 rounded mb-2" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
          <div className="h-6 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-4 w-48 bg-slate-100 rounded mb-4" />
        <div className="h-10 w-full sm:w-40 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  // Admin users — show admin badge, no billing management
  if (tier === 'admin') {
    return (
      <div className="card p-6 bg-slate-900 text-white" role="status">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg">Admin Access</h3>
            <p className="text-sm text-white/70">Full access to all features with no limits or subscription required.</p>
          </div>
        </div>
      </div>
    );
  }

  // Free users — show free plan summary with upgrade prompt
  if (tier === 'free') {
    return (
      <div className="card p-6" role="region" aria-label="Plan & Billing">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-slate-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-900">Free Plan</p>
            <p className="text-sm text-slate-500">$0/mo · Up to 3 invoices per month</p>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-500">
            Free
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Upgrade to Pro, Business, or Enterprise for more invoices, email sending, and custom branding.
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="card p-6"
        role="region"
        aria-label="Plan & Billing"
      >
        {/* Current plan header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accentColor}15` }}>
            <Crown className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">
              {planInfo?.name ?? capitalize(tier)} Plan
            </p>
            <p className="text-sm text-slate-500">
              {planInfo?.price ? `$${planInfo.price.toFixed(2)}/mo` : '—'} · Billed monthly
            </p>
          </div>
          <span
            className={`px-2.5 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
              subscription?.status === 'active'
                ? 'bg-emerald-100 text-emerald-700'
                : cancellationPending
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {cancellationPending ? 'Canceling' : subscription?.status === 'active' ? 'Active' : (subscription?.status ?? 'Unknown')}
          </span>
        </div>

        {/* Billing summary row */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 mb-5 px-1">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span>{planInfo?.price ? `$${planInfo.price.toFixed(2)}/mo` : '—'}</span>
          </div>
          {periodEndFormatted && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                {cancellationPending ? 'Ends on ' : 'Renews on '}
                <strong>{periodEndFormatted}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Cancellation pending banner */}
        {cancellationPending && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">Cancellation scheduled</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Your subscription will end on {periodEndFormatted ?? 'the end of your billing period'}. You'll keep full access until then.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-5"
            role="status"
          >
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">Done</p>
                <p className="text-sm text-emerald-700 mt-0.5">{success}</p>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="text-emerald-400 hover:text-emerald-600"
                aria-label="Dismiss message"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Action area — Cancel / Resume */}
        <div className="border-t border-slate-100 pt-5">
          {eligibility.canCancel && (
            <div className="space-y-2">
              <button
                onClick={handleCancelClick}
                disabled={processing}
                aria-label="Cancel subscription"
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 min-h-[44px]"
              >
                Cancel subscription
              </button>
              <p className="text-xs text-slate-500">
                {periodEndFormatted
                  ? <>You'll keep access until <strong>{periodEndFormatted}</strong>. No further charges.</>
                  : <>You'll keep access until the end of your current billing period. No further charges.</>
                }
              </p>
            </div>
          )}

          {eligibility.canResume && (
            <div className="space-y-3">
              <button
                onClick={handleResume}
                disabled={resumeProcessing}
                aria-label="Resume membership"
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 min-h-[44px] flex items-center justify-center gap-2"
              >
                {resumeProcessing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Resuming...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Resume membership</>
                )}
              </button>
              <p className="text-xs text-slate-500">
                Keep your subscription active and continue billing as normal.
              </p>
              {resumeError && (
                <p className="text-sm text-red-600" role="alert">{resumeError}</p>
              )}
            </div>
          )}

          {!eligibility.canCancel && !eligibility.canResume && eligibility.reason && !cancellationPending && (
            <p className="text-sm text-slate-400">{eligibility.reason}</p>
          )}
        </div>
      </div>

      {/* Confirmation Modal — two-step */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-modal-title"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            {confirmStep === 'explain' ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 id="cancel-modal-title" className="font-bold text-slate-900 text-lg">
                    Cancel your subscription?
                  </h3>
                </div>

                <div className="space-y-3 text-sm text-slate-600 mb-6">
                  <p>
                    You're currently on the <strong>{planInfo?.name ?? tier}</strong> plan.
                  </p>
                  {periodEndFormatted ? (
                    <p>
                      Your access will <strong>continue until {periodEndFormatted}</strong> — the end of your
                      current billing period. You won't be charged again.
                    </p>
                  ) : (
                    <p>
                      Your access will continue until the end of your current billing period. You won't be charged again.
                    </p>
                  )}
                  <p>
                    After that, your account will revert to the <strong>Free</strong> plan with a limit of 3 invoices per month.
                  </p>
                  <p className="text-slate-500">
                    You can change your mind and resume your subscription anytime before the period ends.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={closeModal}
                    disabled={processing}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all min-h-[44px]"
                  >
                    Keep my plan
                  </button>
                  <button
                    onClick={handleConfirmFirst}
                    disabled={processing}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all min-h-[44px]"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 id="cancel-modal-title" className="font-bold text-slate-900 text-lg">
                    Final confirmation
                  </h3>
                </div>

                <p className="text-sm text-slate-600 mb-2">
                  Please confirm you want to schedule cancellation of your <strong>{planInfo?.name ?? tier}</strong> plan.
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  Your access continues through {periodEndFormatted ?? 'the end of your billing period'}, after which you'll
                  be moved to the Free plan.
                </p>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 mb-4 text-sm text-red-700" role="alert">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmStep('explain')}
                    disabled={processing}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all min-h-[44px]"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmFinal}
                    disabled={processing}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {processing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Cancelling...</>
                    ) : (
                      <>Yes, cancel my plan</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
