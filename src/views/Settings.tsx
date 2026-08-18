import { useState, useEffect } from 'react';
import {
  Save, Check, Building2, Palette, DollarSign, FileText,
  Crown, Shield, CreditCard, Lock, X,
} from 'lucide-react';
import { useBusinessProfile } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { PLANS, hasFeature } from '@/lib/plans';
import { INDUSTRY_LIST, type IndustryId } from '@/lib/industryTemplates';
import type { BusinessType } from '@/lib/types';
import LogoUpload from '@/components/LogoUpload';
import ManageBilling from '@/components/ManageBilling';

interface SettingsViewProps {
  onUpgrade: () => void;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

const ACCENT_PRESETS = [
  { name: 'Black', value: '#111827' },
  { name: 'Graphite', value: '#374151' },
  { name: 'Slate', value: '#475569' },
  { name: 'Stone', value: '#57534e' },
  { name: 'Zinc', value: '#52525b' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Amber', value: '#d97706' },
];

export default function SettingsView({ onUpgrade }: SettingsViewProps) {
  const { profile, loading, update, createProfile } = useBusinessProfile();
  const { tier } = useAuth();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', logo_url: '',
    tax_rate: 0, currency: 'USD', currency_symbol: '$',
    invoice_prefix: 'INV', next_invoice_number: 1, notes: '',
    accent_color: '#111827',
    payments_enabled: false,
    business_type: 'services' as BusinessType,
    industry_template: 'general' as IndustryId,
  });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        address: profile.address || '',
        logo_url: profile.logo_url || '',
        tax_rate: profile.tax_rate || 0,
        currency: profile.currency || 'USD',
        currency_symbol: profile.currency_symbol || '$',
        invoice_prefix: profile.invoice_prefix || 'INV',
        next_invoice_number: profile.next_invoice_number || 1,
        notes: profile.notes || '',
        accent_color: profile.accent_color || '#111827',
        payments_enabled: profile.payments_enabled || false,
        business_type: profile.business_type || 'services',
        industry_template: (profile.industry_template as IndustryId) || 'general',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    if (profile) {
      await update(form);
    } else {
      await createProfile({ ...form, name: form.name || 'My Business' });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto animate-pulse">
        <div className="h-8 w-40 bg-slate-200 rounded-lg mb-6" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-10 max-w-3xl mx-auto animate-fade-in pb-bottom-nav md:pb-32">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1 hidden sm:block">Configure your business profile and invoice defaults</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary min-touch" style={{ background: form.accent_color }}>
          {saving ? 'Saving...' : saved ? (
            <><Check className="w-4 h-4 text-emerald-500" /> Saved</>
          ) : (
            <><Save className="w-4 h-4" /> Save</>
          )}
        </button>
      </div>

      {/* Section nav — quick jump anchors */}
      <nav className="flex flex-wrap gap-2 mb-4 md:mb-6 overflow-x-auto scrollbar-thin" aria-label="Settings sections">
        <a href="#billing" className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">
          Plan & Billing
        </a>
        <a href="#business" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors">
          Business
        </a>
        <a href="#invoice" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors">
          Invoice Defaults
        </a>
        <a href="#currency" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors">
          Currency
        </a>
        <a href="#branding" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors">
          Brand Color
        </a>
        <a href="#payments" className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors">
          Payments
        </a>
      </nav>

      {/* Plan & Billing — at the top, easy to find */}
      <div id="billing" className="mb-8 scroll-mt-4">
        <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Crown className="w-5 h-5" style={{ color: form.accent_color }} />
          Plan & Billing
        </h2>
        <p className="text-sm text-slate-500 mb-4">Your current plan, billing details, and subscription management.</p>

        <ManageBilling accentColor={form.accent_color} />

        {/* Plan comparison cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <PlanCard
            name="Free"
            tagline="Everything you need to get started"
            price="$0"
            period="/mo"
            isCurrent={tier === 'free'}
            ctaLabel="Free forever"
            ctaStyle="muted"
            features={[
              { label: 'Up to 3 invoices / month', ok: true },
              { label: 'Unlimited clients & estimates', ok: true },
              { label: 'AI voice invoicing', ok: true },
              { label: 'PDF export', ok: true },
              { label: 'Email sending', ok: false },
              { label: 'Custom branding', ok: false },
              { label: 'Direct payments', ok: false },
            ]}
          />
          <PlanCard
            name="Pro"
            tagline="For growing businesses that need more"
            price="$14.99"
            period="/mo"
            isCurrent={tier === 'pro'}
            ctaLabel={tier === 'admin' ? '—' : 'Upgrade to Pro'}
            ctaStyle={tier === 'admin' ? 'muted' : 'green'}
            onCta={tier !== 'admin' ? onUpgrade : undefined}
            features={[
              { label: 'Up to 50 invoices / month', ok: true },
              { label: 'Unlimited clients & estimates', ok: true },
              { label: 'AI voice invoicing', ok: true },
              { label: 'Email sending', ok: true },
              { label: 'Direct payments', ok: true },
              { label: 'Custom branding', ok: false },
              { label: 'Priority support', ok: false },
            ]}
          />
          <PlanCard
            name="Business"
            tagline="Everything you need to run your operation"
            price="$29.99"
            period="/mo"
            isCurrent={tier === 'business'}
            badge="Most Popular"
            ctaLabel={tier === 'admin' ? '—' : 'Upgrade to Business'}
            ctaStyle={tier === 'admin' ? 'muted' : 'dark'}
            onCta={tier !== 'admin' ? onUpgrade : undefined}
            highlighted
            features={[
              { label: 'Unlimited invoices', ok: true },
              { label: 'Unlimited clients & estimates', ok: true },
              { label: 'AI voice invoicing', ok: true },
              { label: 'Email sending', ok: true },
              { label: 'Direct payments', ok: true },
              { label: 'Custom branding', ok: true },
              { label: 'Priority support', ok: true },
            ]}
          />
          <PlanCard
            name="Enterprise"
            tagline="Custom solutions for large operations"
            price="$99.99"
            period="/mo"
            isCurrent={tier === 'enterprise' || tier === 'admin'}
            ctaLabel={tier === 'admin' ? 'Admin access' : 'Upgrade to Enterprise'}
            ctaStyle="gold"
            onCta={tier !== 'admin' ? onUpgrade : undefined}
            dark
            features={[
              { label: 'Everything in Business', ok: true },
              { label: 'Dedicated account manager', ok: true },
              { label: 'Custom integrations', ok: true },
              { label: 'Advanced automation', ok: true },
              { label: 'Team collaboration (10+)', ok: true },
              { label: 'API access', ok: true },
              { label: 'SLA guarantee', ok: true },
            ]}
          />
        </div>

        <p className="text-xs text-slate-400 text-center mt-4">
          Cancel anytime. Prices in USD. No credit card required for the Free plan.
        </p>
      </div>

      {/* Business info */}
      <div id="business" className="card p-4 md:p-6 mb-4 md:mb-6 scroll-mt-4">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          Business Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label">Business name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">Business type</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {([
                { value: 'retail', label: 'Retail' },
                { value: 'wholesale', label: 'Wholesale' },
                { value: 'services', label: 'Services' },
                { value: 'trades', label: 'Trades' },
                { value: 'boutique', label: 'Boutique' },
                { value: 'other', label: 'Other' },
              ] as const).map(bt => (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => setForm({ ...form, business_type: bt.value })}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all min-touch ${
                    form.business_type === bt.value
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {bt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <label className="label">Default invoice template</label>
            <p className="text-xs text-slate-400 mb-2">New invoices start with this template. You can change it per invoice.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INDUSTRY_LIST.map(tmpl => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setForm({ ...form, industry_template: tmpl.id })}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left min-touch ${
                    form.industry_template === tmpl.id
                      ? 'border-slate-900 bg-slate-50 text-slate-900'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className="block">{tmpl.label}</span>
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5">{tmpl.tagline}</span>
                </button>
              ))}
            </div>
          </div>
          <LogoUpload
            value={form.logo_url}
            onChange={url => setForm({ ...form, logo_url: url })}
            accent={form.accent_color}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="input resize-none"
            />
          </div>
        </div>
      </div>

      {/* Invoice defaults */}
      <div id="invoice" className="card p-6 mb-6 scroll-mt-4">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" />
          Invoice Defaults
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Invoice prefix</label>
              <input
                type="text"
                value={form.invoice_prefix}
                onChange={e => setForm({ ...form, invoice_prefix: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Next number</label>
              <input
                type="number"
                value={form.next_invoice_number}
                onChange={e => setForm({ ...form, next_invoice_number: parseInt(e.target.value) || 1 })}
                min="1"
                className="input"
              />
            </div>
            <div>
              <label className="label">Default tax rate (%)</label>
              <input
                type="number"
                value={form.tax_rate}
                onChange={e => setForm({ ...form, tax_rate: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.01"
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Default Work Done on invoices</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="input resize-none"
            />
          </div>
        </div>
      </div>

      {/* Currency */}
      <div id="currency" className="card p-6 mb-6 scroll-mt-4">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-slate-400" />
          Currency
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => setForm({ ...form, currency: c.code, currency_symbol: c.symbol })}
              className={`p-3 rounded-xl border text-left transition-all ${
                form.currency === c.code
                  ? 'border-slate-900 bg-slate-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <p className="font-semibold text-slate-900 text-sm">{c.symbol} {c.code}</p>
              <p className="text-xs text-slate-400">{c.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div id="branding" className="card p-6 mb-6 scroll-mt-4">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Palette className="w-4 h-4 text-slate-400" />
          Brand Color
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 mb-4">
          {ACCENT_PRESETS.map(color => (
            <button
              key={color.value}
              onClick={() => setForm({ ...form, accent_color: color.value })}
              className={`aspect-square rounded-xl flex items-center justify-center transition-all ${
                form.accent_color === color.value ? 'ring-2 ring-offset-2 ring-slate-900 scale-105' : 'hover:scale-105'
              }`}
              style={{ background: color.value }}
              title={color.name}
            >
              {form.accent_color === color.value && <Check className="w-4 h-4 text-white" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="label mb-0">Custom:</label>
          <input
            type="color"
            value={form.accent_color}
            onChange={e => setForm({ ...form, accent_color: e.target.value })}
            className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
          />
          <input
            type="text"
            value={form.accent_color}
            onChange={e => setForm({ ...form, accent_color: e.target.value })}
            className="input flex-1 max-w-32 font-mono"
          />
        </div>
      </div>

      {/* Payments */}
      <div id="payments" className="card p-6 mb-6 scroll-mt-4">
        <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-400" />
          Online Payments
        </h2>
        <p className="text-sm text-slate-500 mb-5">Let customers pay invoices directly with a credit card.</p>

        {!hasFeature(tier, 'directPayments') && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-sm text-amber-700 mb-5">
            <Lock className="w-4 h-4 flex-shrink-0" />
            Direct payments are available on the Pro plan and above.
            <button onClick={onUpgrade} className="font-semibold underline ml-auto">Upgrade</button>
          </div>
        )}

        <div className="space-y-4">
          <label className={`flex items-center gap-3 cursor-pointer ${!hasFeature(tier, 'directPayments') ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              checked={form.payments_enabled}
              onChange={e => setForm({ ...form, payments_enabled: e.target.checked })}
              disabled={!hasFeature(tier, 'directPayments')}
              className="w-5 h-5 rounded-lg border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-900/30"
            />
            <div>
              <span className="font-medium text-slate-900">Accept card payments</span>
              <p className="text-sm text-slate-500">Customers can pay invoices online via Stripe Checkout.</p>
            </div>
          </label>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end mb-10">
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ background: form.accent_color }}>
          {saving ? 'Saving...' : saved ? (
            <><Check className="w-4 h-4 text-emerald-500" /> Saved</>
          ) : (
            <><Save className="w-4 h-4" /> Save Settings</>
          )}
        </button>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  tagline,
  price,
  period,
  isCurrent,
  badge,
  highlighted,
  dark,
  ctaLabel,
  ctaStyle,
  onCta,
  features,
}: {
  name: string;
  tagline: string;
  price: string;
  period: string;
  isCurrent: boolean;
  badge?: string;
  highlighted?: boolean;
  dark?: boolean;
  ctaLabel: string;
  ctaStyle: 'muted' | 'green' | 'dark' | 'gold';
  onCta?: () => void;
  features: { label: string; ok: boolean }[];
}) {
  const checkColor = dark ? 'text-amber-400' : 'text-emerald-500';
  const xColor = dark ? 'text-slate-600' : 'text-slate-300';
  const textColor = dark ? 'text-slate-200' : 'text-slate-700';
  const mutedText = dark ? 'text-slate-400' : 'text-slate-500';
  const priceColor = dark ? 'text-white' : 'text-slate-900';
  const nameColor = dark ? 'text-white' : 'text-slate-900';

  const ctaClasses: Record<string, string> = {
    muted: 'bg-slate-100 text-slate-400 cursor-default',
    green: 'bg-emerald-500 hover:bg-emerald-600 text-white transition-colors',
    dark: 'bg-slate-900 hover:bg-slate-800 text-white transition-colors',
    gold: 'bg-amber-400 hover:bg-amber-300 text-slate-900 transition-colors',
  };

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
        highlighted
          ? 'border-slate-900 shadow-md ring-1 ring-slate-900/5'
          : dark
            ? 'border-slate-900 bg-slate-900'
            : isCurrent
              ? 'border-slate-900 bg-white'
              : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      {badge && (
        <div className="inline-flex self-start px-2.5 py-0.5 text-[10px] font-bold text-white bg-slate-900 rounded-full uppercase tracking-widest mb-3">
          {badge}
        </div>
      )}

      <h3 className={`text-lg font-extrabold mb-1 ${nameColor}`}>{name}</h3>
      <p className={`text-xs mb-4 min-h-[32px] ${mutedText}`}>{tagline}</p>

      <div className="flex items-baseline gap-1 flex-wrap mb-1">
        <span className={`text-[10px] ${mutedText}`}>USD</span>
        <span className={`text-xl font-extrabold leading-none ${priceColor}`}>{price}</span>
        <span className={`text-xs ${mutedText}`}>{period}</span>
      </div>
      <p className={`text-xs mb-4 ${mutedText}`}>Billed monthly</p>

      {isCurrent ? (
        <div className={`text-center text-sm py-2.5 rounded-xl mb-4 ${dark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-400'}`}>
          Current plan
        </div>
      ) : (
        <button
          onClick={onCta}
          className={`w-full py-2.5 rounded-xl text-sm font-bold mb-4 ${ctaClasses[ctaStyle]}`}
        >
          {ctaLabel}
        </button>
      )}

      <ul className="space-y-2.5 text-sm flex-1">
        {features.map((feat) => (
          <li key={feat.label} className={`flex items-start gap-2.5 ${feat.ok ? textColor : dark ? 'text-slate-600' : 'text-slate-300'}`}>
            {feat.ok ? (
              <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${checkColor}`} />
            ) : (
              <X className={`w-4 h-4 flex-shrink-0 mt-0.5 ${xColor}`} />
            )}
            <span>{feat.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
