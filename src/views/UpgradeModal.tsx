import { useState, useRef, useCallback } from 'react';
import {
  X, Check, Sparkles, Loader2, AlertTriangle, ArrowUpRight,
  Shield, Lock,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { PLANS, PLAN_ORDER } from '@/lib/plans';
import type { SubscriptionTier } from '@/lib/types';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

export default function UpgradeModal({ open, onClose, feature }: UpgradeModalProps) {
  const { tier, subscription } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const activeRequestRef = useRef<string | null>(null);

  const handleUpgrade = useCallback(async (planId: string) => {
    if (upgrading || redirecting) return;
    if (activeRequestRef.current === planId) return;

    activeRequestRef.current = planId;
    setUpgrading(true);
    setError(null);
    setConflict(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to upgrade.');
        return;
      }
      const { data, error: fnErr } = await supabase.functions.invoke('create-subscription-session', {
        body: {
          plan: planId,
          successUrl: `${window.location.origin}?subscribed=true`,
          cancelUrl: window.location.origin,
        },
      });

      if (fnErr) {
        let msg = data?.error || null;
        let code = data?.code || null;
        if (!msg) {
          try {
            const body = await (fnErr as { context?: { json?: () => Promise<{ error?: string; code?: string }> } }).context?.json?.();
            msg = body?.error || null;
            code = body?.code || null;
          } catch { /* response body not parseable — fall through to default error */ }
        }

        if (code === 'SUBSCRIPTION_EXISTS') {
          setConflict(true);
          return;
        }
        if (code === 'CHECKOUT_IN_PROGRESS') {
          setError(msg || 'A checkout is already in progress. Please wait a moment.');
          return;
        }

        setError(msg || 'Could not start checkout. Please try again.');
        return;
      }
      if (!data?.url) {
        setError(data?.error || 'No checkout URL returned. Please try again.');
        return;
      }

      setRedirecting(true);
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setUpgrading(false);
      activeRequestRef.current = null;
    }
  }, [upgrading, redirecting]);

  const isButtonDisabled = upgrading || redirecting;

  if (!open) return null;

  // Admin state — full access, no billing needed
  if (tier === 'admin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-sm rounded-2xl border border-indigo-400/20 bg-gradient-to-b from-slate-900 to-slate-950 p-8 text-center shadow-2xl animate-scale-in overflow-hidden">
          <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-indigo-500/15 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-cyan-500/10 blur-[80px] pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-400/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-indigo-300" />
            </div>
            <h3 className="text-lg font-bold text-white">Admin Access</h3>
            <p className="text-sm text-slate-400 mt-1.5">You have full access to all features with no limits.</p>
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors min-h-[44px]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cancellationPending = subscription?.cancel_at_period_end === true;
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const renderButtonContent = (isCurrent: boolean, cta: string) => {
    if (redirecting) return <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>;
    if (upgrading) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (isCurrent) return <><Check className="w-4 h-4" /> Current plan</>;
    return cta;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      style={{ background: 'rgba(3, 7, 18, 0.80)', backdropFilter: 'blur(10px)' }}
    >
      {/* ── AURORA / GRID BACKGROUND ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-indigo-600/12 blur-[140px]" />
        <div className="absolute -bottom-40 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-1/3 right-1/3 w-[300px] h-[300px] rounded-full bg-indigo-500/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(rgba(165,180,252,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(165,180,252,0.4) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            transform: 'perspective(800px) rotateX(60deg) translateY(-10%)',
            transformOrigin: 'center top',
          }}
        />
      </div>

      <div
        className="relative w-full max-w-5xl rounded-2xl sm:rounded-3xl border border-indigo-400/15 shadow-2xl my-4 sm:my-8 animate-scale-in overflow-hidden"
        style={{ background: 'linear-gradient(180deg, #0b1224 0%, #0a0f1e 100%)' }}
      >
        {/* Inner highlight line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent" />

        {/* Close */}
        <div className="flex justify-end p-3 sm:p-4 pb-0">
          <button
            onClick={onClose}
            disabled={isButtonDisabled}
            aria-label="Close pricing"
            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero */}
        <div className="px-5 sm:px-8 pb-6 sm:pb-8 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/10 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-300">Pricing</span>
          </div>
          {feature && !conflict && !redirecting && (
            <p className="text-sm text-cyan-300 font-medium mb-2">{feature} requires a paid plan</p>
          )}
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight mb-3">
            Choose your plan
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Start free and upgrade as you grow. Cancel anytime — access continues through your billing period.
          </p>

          {/* Cancellation pending notice */}
          {cancellationPending && periodEnd && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-400/25 bg-amber-500/10 text-amber-200 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Your {tier} plan cancels on {periodEnd}. Resubscribe after it ends.
            </div>
          )}
        </div>

        {/* ── PLAN CARDS ── */}
        <div className="px-4 sm:px-6 lg:px-8 pb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 items-stretch">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId as Exclude<SubscriptionTier, 'admin'>];
            const isCurrent = tier === plan.id;
            const isPopular = plan.popular;
            const isEnterprise = plan.id === 'enterprise';

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-300 ${
                  isPopular
                    ? 'border-indigo-400/35 bg-gradient-to-b from-indigo-950/40 to-slate-950/60 shadow-lg shadow-indigo-950/30'
                    : isEnterprise
                      ? 'border-slate-600/30 bg-gradient-to-b from-slate-900/60 to-slate-950/80'
                      : isCurrent
                        ? 'border-cyan-400/30 bg-cyan-950/15'
                        : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
                }`}
                style={
                  isPopular
                    ? { boxShadow: '0 0 24px -4px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)' }
                    : isEnterprise
                      ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }
                      : { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }
                }
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-[10px] font-bold text-white rounded-full uppercase tracking-widest border border-indigo-400/30" style={{ background: 'linear-gradient(90deg, #4f46e5, #06b6d4)' }}>
                    Most Popular
                  </div>
                )}

                {/* Header */}
                <h3 className={`text-lg font-extrabold mb-1 ${isEnterprise ? 'text-slate-200' : 'text-white'}`}>
                  {plan.name}
                </h3>
                <p className="text-xs text-slate-400 mb-2 min-h-[20px]">{plan.tagline}</p>
                <p className="text-[11px] text-slate-500 mb-4 min-h-[16px]">{plan.bestFor}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1 flex-wrap mb-1">
                  <span className="text-[10px] text-slate-500">USD</span>
                  <span className={`text-2xl font-extrabold leading-none ${isEnterprise ? 'text-slate-100' : 'text-white'}`}>
                    ${plan.price % 1 === 0 ? plan.price : plan.price.toFixed(2)}
                  </span>
                  <span className="text-slate-500 text-xs">/mo</span>
                </div>
                <p className="text-[11px] text-slate-500 mb-4">Billed monthly</p>

                {/* CTA */}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isButtonDisabled || isCurrent}
                  aria-label={`${plan.cta} — ${plan.name} plan at $${plan.price.toFixed(2)} per month`}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-all min-h-[44px] flex items-center justify-center gap-2 mb-4 ${
                    isCurrent
                      ? 'bg-white/5 text-slate-500 cursor-default border border-white/5'
                      : isPopular
                        ? 'text-white border border-indigo-400/30 hover:border-indigo-400/50'
                        : isEnterprise
                          ? 'bg-slate-700/40 text-slate-200 border border-slate-500/20 hover:bg-slate-700/60 hover:border-slate-400/30'
                          : 'bg-white/8 text-slate-200 border border-white/10 hover:bg-white/12 hover:border-white/20'
                  }`}
                  style={isPopular && !isCurrent ? { background: 'linear-gradient(90deg, #4f46e5, #06b6d4)' } : undefined}
                >
                  {renderButtonContent(isCurrent, plan.cta)}
                </button>

                {/* Features */}
                <ul className="space-y-2.5 text-sm flex-1">
                  {plan.features.map((feat, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-2.5 ${
                        feat.included ? 'text-slate-300' : feat.comingSoon ? 'text-slate-500' : 'text-slate-600'
                      }`}
                    >
                      {feat.included ? (
                        <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      ) : feat.comingSoon ? (
                        <span className="w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-slate-600/30 rounded">soon</span>
                      ) : (
                        <X className="w-4 h-4 text-slate-700 flex-shrink-0 mt-0.5" />
                      )}
                      <span>
                        {feat.label}
                        {feat.comingSoon && <span className="text-slate-600 italic"> — Coming soon</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ── CONFLICT BANNER ── */}
        {conflict && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mb-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-200">You already have an active subscription</p>
                <p className="text-sm text-amber-300/80 mt-0.5 mb-3">
                  You can manage your existing subscription using the Manage Billing section in Settings.
                </p>
                <button
                  onClick={() => {
                    setConflict(false);
                    onClose();
                    window.location.hash = '#/settings';
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 text-amber-200 border border-amber-400/30 hover:bg-amber-500/30 transition-colors min-h-[44px]"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  Go to Manage Billing
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── REDIRECTING BANNER ── */}
        {redirecting && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-200">Redirecting to secure checkout...</p>
          </div>
        )}

        {/* ── ERROR ── */}
        {error && !conflict && !redirecting && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mb-4 text-sm text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="px-5 sm:px-8 py-5 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500 text-center sm:text-left">
            Cancel anytime. Access continues through your billing period.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="w-3 h-3" />
            Secure checkout powered by Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
