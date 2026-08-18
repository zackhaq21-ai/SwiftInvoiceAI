import type { SubscriptionTier } from '@/lib/types';

export const FREE_INVOICE_LIMIT = 3;
export const PRO_PRICE = 14.99;
export const BUSINESS_PRICE = 29.99;
export const ENTERPRISE_PRICE = 99.99;

export interface PlanFeature {
  label: string;
  included: boolean;
  /** When true, the feature is real but not yet implemented — shows "Coming soon" */
  comingSoon?: boolean;
}

export interface PlanInfo {
  id: SubscriptionTier;
  name: string;
  price: number;
  tagline: string;
  /** Outcome-oriented marketing copy for the plan header */
  bestFor: string;
  /** Specific CTA button text */
  cta: string;
  maxInvoices: number | null;
  emailSending: boolean;
  voiceInvoicing: boolean;
  customBranding: boolean;
  pdfExport: boolean;
  clientManagement: boolean;
  prioritySupport: boolean;
  dedicatedSupport: boolean;
  directPayments: boolean;
  /** Feature list for the comparison table / plan cards */
  features: PlanFeature[];
  /** Whether this plan is marked as "Most Popular" */
  popular?: boolean;
}

export const PLANS: Record<Exclude<SubscriptionTier, 'admin'>, PlanInfo> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    tagline: 'Start invoicing professionally',
    bestFor: 'Solo operators getting started',
    cta: 'Start free',
    maxInvoices: FREE_INVOICE_LIMIT,
    emailSending: false,
    voiceInvoicing: true,
    customBranding: false,
    pdfExport: true,
    clientManagement: true,
    prioritySupport: false,
    dedicatedSupport: false,
    directPayments: false,
    features: [
      { label: 'Up to 3 invoices per month', included: true },
      { label: 'Unlimited estimates', included: true },
      { label: 'Voice invoicing', included: true },
      { label: 'PDF export', included: true },
      { label: 'Client management', included: true },
      { label: 'Email sending', included: false },
      { label: 'Direct payments (Stripe)', included: false },
      { label: 'Custom branding', included: false },
      { label: 'Priority support', included: false },
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: PRO_PRICE,
    tagline: 'Get paid faster',
    bestFor: 'Solo operators who bill regularly',
    cta: 'Upgrade to Pro',
    maxInvoices: 50,
    emailSending: true,
    voiceInvoicing: true,
    customBranding: false,
    pdfExport: true,
    clientManagement: true,
    prioritySupport: false,
    dedicatedSupport: false,
    directPayments: true,
    features: [
      { label: 'Everything in Free, plus:', included: true },
      { label: 'Up to 50 invoices per month', included: true },
      { label: 'Email invoices directly to clients', included: true },
      { label: 'Direct payments via Stripe', included: true },
      { label: 'Voice invoicing', included: true },
      { label: 'PDF export', included: true },
      { label: 'Client management', included: true },
      { label: 'Custom branding', included: false },
      { label: 'Priority support', included: false },
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: BUSINESS_PRICE,
    tagline: 'Run the whole operation',
    bestFor: 'Established businesses with regular billing',
    cta: 'Choose Business',
    maxInvoices: null,
    emailSending: true,
    voiceInvoicing: true,
    customBranding: true,
    pdfExport: true,
    clientManagement: true,
    prioritySupport: true,
    dedicatedSupport: false,
    directPayments: true,
    popular: true,
    features: [
      { label: 'Everything in Pro, plus:', included: true },
      { label: 'Unlimited invoices', included: true },
      { label: 'Custom branding (logo, colors)', included: true },
      { label: 'Priority support', included: true },
      { label: 'Email invoices directly to clients', included: true },
      { label: 'Direct payments via Stripe', included: true },
      { label: 'Voice invoicing', included: true },
      { label: 'PDF export', included: true },
      { label: 'Dedicated account manager', included: false },
    ],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: ENTERPRISE_PRICE,
    tagline: 'Scale with control',
    bestFor: 'Larger operations needing dedicated support',
    cta: 'Choose Enterprise',
    maxInvoices: null,
    emailSending: true,
    voiceInvoicing: true,
    customBranding: true,
    pdfExport: true,
    clientManagement: true,
    prioritySupport: true,
    dedicatedSupport: true,
    directPayments: true,
    features: [
      { label: 'Everything in Business, plus:', included: true },
      { label: 'Dedicated account manager', included: true },
      { label: 'Unlimited invoices', included: true },
      { label: 'Custom branding (logo, colors)', included: true },
      { label: 'Priority support', included: true },
      { label: 'Team collaboration', included: false, comingSoon: true },
      { label: 'API access', included: false, comingSoon: true },
      { label: 'Custom integrations', included: false, comingSoon: true },
    ],
  },
};

export const PLAN_ORDER: SubscriptionTier[] = ['free', 'pro', 'business', 'enterprise'];

export const STRIPE_PRICE_ENV_KEYS: Record<string, string> = {
  pro: 'STRIPE_PRICE_PRO',
  business: 'STRIPE_PRICE_BUSINESS',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
};

/**
 * Returns the plan info for a given tier. Admin gets business-level features
 * with an "Admin" name.
 */
export function getPlanInfo(tier: SubscriptionTier): PlanInfo {
  if (tier === 'admin') return { ...PLANS.business, id: 'admin', name: 'Admin' };
  return PLANS[tier];
}

/**
 * Returns true if the user can create a new invoice based on their tier
 * and current invoice count.
 */
export function canCreateInvoice(
  tier: SubscriptionTier,
  currentInvoiceCount: number,
): boolean {
  const info = getPlanInfo(tier);
  if (info.maxInvoices === null) return true;
  return currentInvoiceCount < info.maxInvoices;
}

/**
 * Returns true if the given tier has access to the specified feature.
 * Admin accounts have access to everything.
 */
export function hasFeature(tier: SubscriptionTier, feature: keyof Omit<PlanInfo, 'id' | 'name' | 'price' | 'tagline' | 'bestFor' | 'cta' | 'maxInvoices' | 'features' | 'popular'>): boolean {
  if (tier === 'admin') return true;
  return PLANS[tier][feature] as boolean;
}

/**
 * Returns the CTA text for a given tier, or a fallback for the current plan.
 */
export function getCtaText(tier: SubscriptionTier, isCurrent: boolean): string {
  if (isCurrent) return 'Current plan';
  if (tier === 'admin') return 'Admin access';
  if (tier === 'free') return 'Start free';
  return getPlanInfo(tier).cta;
}

/**
 * Returns true if the Stripe Price ID env var is configured for the given plan.
 * Free plan doesn't need a Price ID.
 */
export function hasStripePriceId(planId: string): boolean {
  if (planId === 'free') return true;
  const envKey = STRIPE_PRICE_ENV_KEYS[planId];
  if (!envKey) return false;
  return typeof import.meta !== 'undefined' && import.meta.env
    ? Boolean(import.meta.env[`VITE_${envKey}`])
    : false;
}
