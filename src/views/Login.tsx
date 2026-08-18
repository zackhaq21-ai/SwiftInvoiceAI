import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, ArrowRight, Loader2, FileText, Mic, BarChart3, Zap, TrendingUp, Clock, DollarSign, Star, ChevronLeft, ChevronRight, CheckCircle2, MailCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { LogoWordmarkDark, LogoMark } from '@/components/Logo';
import { friendlyError, NO_SESSION_MESSAGE, SUCCESS_MESSAGE, mapCallbackError, CALLBACK_INVALID_MESSAGE } from '@/lib/signupResult';

const FACTS = [
  { emoji: '🗣️', stat: '5x faster', detail: 'Voice invoicing is 5x faster than typing on a phone keyboard.' },
  { emoji: '💸', stat: '$300B+', detail: 'Small businesses are collectively owed over $300B in unpaid invoices at any time.' },
  { emoji: '⏱️', stat: '48 hours', detail: 'Businesses that invoice within 24 hours get paid in under 48 hours on average.' },
  { emoji: '📱', stat: '60 seconds', detail: 'Most SwiftInvoiceAI users send their first invoice within 60 seconds of signing up.' },
  { emoji: '📊', stat: '120 hrs/year', detail: 'The average small business spends 120 hours a year on manual invoicing. We cut that to under 10.' },
  { emoji: '✅', stat: '2x paid faster', detail: 'Professional-looking invoices get paid 2x faster than plain text or handwritten ones.' },
];

const FEATURES = [
  { icon: Mic,      title: 'Voice invoicing',       desc: 'Speak a job — get a polished invoice instantly.' },
  { icon: FileText, title: 'Professional templates', desc: 'Clean, branded invoices clients love to receive.' },
  { icon: BarChart3, title: 'Revenue dashboard',    desc: 'See who owes you and how much at a glance.' },
  { icon: Zap,      title: 'Send in one tap',        desc: 'Email invoices directly to clients from the app.' },
];

const STATS = [
  { icon: TrendingUp,  value: '5x',   label: 'Faster invoicing' },
  { icon: Clock,       value: '48hr', label: 'Avg. pay time'    },
  { icon: Star,        value: '4.9',  label: 'User rating'      },
  { icon: DollarSign,  value: 'Free', label: 'To get started'   },
];

export default function Login() {
  const { signIn, signUp, resendConfirmation } = useAuth();
  const [mode, setMode]       = useState<'login' | 'signup' | 'reset'>('signup');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [callbackError, setCallbackError] = useState(false);
  const [resending, setResending] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [factIdx, setFactIdx] = useState(0);
  const [factAnim, setFactAnim] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setError(null); setSuccessMsg(null); }, [mode]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const state = mapCallbackError({
      error: params.get('error'),
      errorDescription: params.get('error_description'),
      errorCode: params.get('error_code'),
    });
    if (state.kind === 'callback_error') {
      setCallbackError(true);
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
    }
  }, []);

  const changeFact = (next: number) => {
    setFactAnim(false);
    setTimeout(() => {
      setFactIdx((next + FACTS.length) % FACTS.length);
      setFactAnim(true);
    }, 180);
  };

  useEffect(() => {
    intervalRef.current = setInterval(() => changeFact(factIdx + 1), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [factIdx]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (mode === 'signup') {
      const { error: authError, sessionEstablished } = await signUp(email.trim(), password);
      setLoading(false);
      if (authError) {
        setError(friendlyError(authError));
        return;
      }
      if (sessionEstablished) {
        setSuccessMsg(SUCCESS_MESSAGE);
        return;
      }
      setSuccessMsg(null);
      setCheckEmail(true);
      return;
    }

    const result = await signIn(email.trim(), password);
    setLoading(false);
    if (result.error) {
      const msg = result.error.toLowerCase();
      if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
        setError('Incorrect email or password.');
      } else {
        setError(result.error);
      }
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/`,
    });
    setResetting(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
  };

  const handleResend = async () => {
    if (resending || !email.trim()) return;
    setResending(true);
    const { error: resendError } = await resendConfirmation(email.trim());
    setResending(false);
    if (resendError) {
      setError(friendlyError(resendError));
    }
  };

  const fact = FACTS[factIdx];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LEFT PANEL (desktop only) — premium deep midnight ── */}
      <div className="hidden lg:flex lg:w-[52%] text-white flex-col justify-between p-12 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #070b16 0%, #0a0f1e 50%, #060912 100%)' }}>
        {/* Aurora glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-24 w-[500px] h-[500px] rounded-full bg-indigo-600/12 blur-[130px]" />
          <div className="absolute -bottom-40 -right-24 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[150px]" />
          <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] rounded-full bg-indigo-500/6 blur-[100px]" />
          {/* Perspective grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(165,180,252,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(165,180,252,0.5) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              transform: 'perspective(800px) rotateX(60deg) translateY(-5%)',
              transformOrigin: 'center top',
            }}
          />
          {/* Orbital accent */}
          <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full border border-indigo-400/10 blur-sm" />
          <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full border border-indigo-400/5" />
        </div>

        {/* Logo */}
        <div className="relative">
          <LogoWordmarkDark className="h-8 w-auto" showTagline />
        </div>

        {/* Hero text */}
        <div className="relative space-y-10">
          <div>
            <h1 className="text-[2.6rem] font-extrabold leading-[1.12] tracking-tight mb-4">
              Invoicing that works<br />as fast as you do.
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-sm">
              Speak a job, snap a photo, or type — SwiftInvoiceAI turns it into a professional invoice in seconds.
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 flex items-center gap-3 hover:bg-white/[0.07] transition-colors" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-none">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/8 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-200" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-xs text-slate-500">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="relative text-sm text-slate-600">Free to start — no credit card required.</p>
      </div>

      {/* ── RIGHT PANEL (form + extras — all screen sizes) ── */}
      <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
        {/* Subtle aurora blobs matching left panel */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-100/40 blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-cyan-100/30 blur-3xl translate-y-1/2 -translate-x-1/3" />
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: 'linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-[380px]">

            {/* ── LOGO LOCKUP (always visible) ── */}
            <div className="flex flex-col items-center mb-8">
              <LogoMark className="h-16 w-16 shadow-lg shadow-slate-900/20 rounded-2xl mb-3" />
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Swift Invoice AI</h1>
              <p className="text-sm text-slate-500 mt-0.5">Invoice faster. Get paid sooner.</p>
            </div>

            {/* ── FACTS CAROUSEL ── */}
            <div className="rounded-2xl p-4 mb-7 relative overflow-hidden border border-indigo-400/15" style={{ background: 'linear-gradient(135deg, #0b1224, #111a35)' }}>
              {/* subtle shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-40 pointer-events-none" />
              <div className="flex items-center justify-between gap-3 relative">
                <button
                  onClick={() => changeFact(factIdx - 1)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Previous fact"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-white" />
                </button>
                <div
                  className="flex-1 min-h-[64px] flex flex-col justify-center transition-all duration-200"
                  style={{ opacity: factAnim ? 1 : 0, transform: factAnim ? 'translateY(0)' : 'translateY(6px)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl leading-none">{fact.emoji}</span>
                    <span className="text-cyan-400 font-bold text-sm">{fact.stat}</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{fact.detail}</p>
                </div>
                <button
                  onClick={() => changeFact(factIdx + 1)}
                  className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Next fact"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              {/* dot indicators */}
              <div className="flex justify-center gap-1.5 mt-3 relative">
                {FACTS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => changeFact(i)}
                    className={`rounded-full transition-all duration-200 ${i === factIdx ? 'w-5 h-1.5 bg-cyan-400' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}`}
                    aria-label={`Go to fact ${i + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* ── CALLBACK ERROR BANNER ── */}
            {callbackError && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-800 font-medium mb-2">{CALLBACK_INVALID_MESSAGE}</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => { setCallbackError(false); setCheckEmail(true); }}
                      className="text-sm font-semibold text-amber-900 hover:underline"
                    >
                      Request a new verification email
                    </button>
                    <button
                      onClick={() => { setCallbackError(false); setMode('login'); }}
                      className="text-sm font-semibold text-amber-900 hover:underline"
                    >
                      Go to sign in
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── FORM ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              {mode === 'reset' ? (
                <>
                  <h2 className="text-xl font-bold text-slate-900 mb-0.5">Reset your password</h2>
                  <p className="text-sm text-slate-500 mb-5">
                    {resetSent
                      ? 'Check your inbox for a reset link.'
                      : "Enter your email and we'll send you a link to reset your password."}
                  </p>

                  {resetSent ? (
                    <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center">
                      Reset link sent to <strong>{resetEmail}</strong>. Check your inbox (and spam folder).
                    </div>
                  ) : (
                    <form onSubmit={handleReset} className="space-y-4">
                      <div>
                        <label className="label">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="email"
                            value={resetEmail}
                            onChange={e => setResetEmail(e.target.value)}
                            placeholder="you@business.com"
                            className="input pl-10"
                            autoFocus
                            required
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={resetting}
                        className="btn-primary w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 mt-1 min-h-[44px]"
                      >
                        {resetting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Send reset link
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  <div className="mt-5 text-center text-sm text-slate-500">
                    Remember your password?{' '}
                    <button
                      onClick={() => { setMode('login'); setError(null); setResetSent(false); }}
                      className="text-slate-900 font-semibold hover:underline"
                    >
                      Back to sign in
                    </button>
                  </div>
                </>
              ) : checkEmail ? (
                <>
                  <h2 className="text-xl font-bold text-slate-900 mb-0.5">Verify your email</h2>
                  <p className="text-sm text-slate-500 mb-5">Almost there — just one more step.</p>

                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-4 mb-4 flex gap-3 items-start">
                    <MailCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-800 leading-relaxed">{NO_SESSION_MESSAGE}</p>
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 mb-4">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleResend}
                    disabled={resending || !email.trim()}
                    className="btn-primary w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 min-h-[44px]"
                  >
                    {resending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        Resend verification email
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="mt-5 text-center text-sm text-slate-500">
                    Already confirmed?{' '}
                    <button
                      onClick={() => { setCheckEmail(false); setMode('login'); }}
                      className="text-slate-900 font-semibold hover:underline"
                    >
                      Sign in
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-slate-900 mb-0.5">
                    {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                  </h2>
                  <p className="text-sm text-slate-500 mb-5">
                    {mode === 'signup' ? 'Start creating invoices in under a minute.' : 'Sign in to continue.'}
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="label">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="you@business.com"
                          className="input pl-10"
                          autoFocus
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                          className="input pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={() => { setResetEmail(email); setResetSent(false); setError(null); setMode('reset'); }}
                          className="text-xs text-slate-500 hover:text-slate-900 hover:underline mt-1.5"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>

                    {successMsg && (
                      <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        {successMsg}
                      </div>
                    )}

                    {error && (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 mt-1 min-h-[44px]"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          {mode === 'signup' ? 'Create account' : 'Sign in'}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-5 text-center text-sm text-slate-500">
                    {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                    <button
                      onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
                      className="text-slate-900 font-semibold hover:underline"
                    >
                      {mode === 'signup' ? 'Sign in' : 'Sign up free'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ── MINI FEATURE PILLS (mobile only — desktop has the full left panel) ── */}
            <div className="lg:hidden mt-5 grid grid-cols-2 gap-2">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 leading-tight">{f.title}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-slate-400 mt-5">Free to start — no credit card required.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
