import { describe, it, expect } from 'vitest';
import {
  canCreateInvoice,
  hasFeature,
  getPlanInfo,
  getCtaText,
  PLANS,
  PLAN_ORDER,
} from '@/lib/plans';

describe('getPlanInfo', () => {
  it('returns correct info for each tier', () => {
    expect(getPlanInfo('free').name).toBe('Free');
    expect(getPlanInfo('pro').name).toBe('Pro');
    expect(getPlanInfo('business').name).toBe('Business');
    expect(getPlanInfo('enterprise').name).toBe('Enterprise');
  });

  it('admin tier gets business-level features', () => {
    const adminInfo = getPlanInfo('admin');
    expect(adminInfo.id).toBe('admin');
    expect(adminInfo.name).toBe('Admin');
    expect(adminInfo.directPayments).toBe(true);
    expect(adminInfo.customBranding).toBe(true);
  });
});

describe('canCreateInvoice', () => {
  it('free plan has limit of 3', () => {
    expect(canCreateInvoice('free', 0)).toBe(true);
    expect(canCreateInvoice('free', 2)).toBe(true);
    expect(canCreateInvoice('free', 3)).toBe(false);
  });

  it('pro plan has limit of 50', () => {
    expect(canCreateInvoice('pro', 49)).toBe(true);
    expect(canCreateInvoice('pro', 50)).toBe(false);
  });

  it('business and enterprise have no limits', () => {
    expect(canCreateInvoice('business', 9999)).toBe(true);
    expect(canCreateInvoice('enterprise', 9999)).toBe(true);
  });

  it('admin has no limits', () => {
    expect(canCreateInvoice('admin', 9999)).toBe(true);
  });
});

describe('hasFeature', () => {
  it('free plan has limited features', () => {
    expect(hasFeature('free', 'emailSending')).toBe(false);
    expect(hasFeature('free', 'directPayments')).toBe(false);
    expect(hasFeature('free', 'voiceInvoicing')).toBe(true);
    expect(hasFeature('free', 'pdfExport')).toBe(true);
  });

  it('pro plan has email and payments', () => {
    expect(hasFeature('pro', 'emailSending')).toBe(true);
    expect(hasFeature('pro', 'directPayments')).toBe(true);
    expect(hasFeature('pro', 'customBranding')).toBe(false);
  });

  it('admin has all features', () => {
    expect(hasFeature('admin', 'emailSending')).toBe(true);
    expect(hasFeature('admin', 'directPayments')).toBe(true);
    expect(hasFeature('admin', 'customBranding')).toBe(true);
    expect(hasFeature('admin', 'prioritySupport')).toBe(true);
    expect(hasFeature('admin', 'dedicatedSupport')).toBe(true);
  });
});

describe('PLAN_ORDER', () => {
  it('lists plans in order from free to enterprise', () => {
    expect(PLAN_ORDER).toEqual(['free', 'pro', 'business', 'enterprise']);
  });
});

describe('plan prices (must not change)', () => {
  it('Free is $0/mo', () => {
    expect(PLANS.free.price).toBe(0);
  });

  it('Pro is $14.99/mo', () => {
    expect(PLANS.pro.price).toBe(14.99);
  });

  it('Business is $29.99/mo', () => {
    expect(PLANS.business.price).toBe(29.99);
  });

  it('Enterprise is $99.99/mo', () => {
    expect(PLANS.enterprise.price).toBe(99.99);
  });
});

describe('getCtaText', () => {
  it('returns "Start free" for free plan', () => {
    expect(getCtaText('free', false)).toBe('Start free');
  });

  it('returns "Upgrade to Pro" for pro plan', () => {
    expect(getCtaText('pro', false)).toBe('Upgrade to Pro');
  });

  it('returns "Choose Business" for business plan', () => {
    expect(getCtaText('business', false)).toBe('Choose Business');
  });

  it('returns "Choose Enterprise" for enterprise plan', () => {
    expect(getCtaText('enterprise', false)).toBe('Choose Enterprise');
  });

  it('returns "Current plan" when isCurrent is true', () => {
    expect(getCtaText('pro', true)).toBe('Current plan');
    expect(getCtaText('business', true)).toBe('Current plan');
  });

  it('returns "Admin access" for admin tier', () => {
    expect(getCtaText('admin', false)).toBe('Admin access');
  });
});

describe('plan features — honest advertising', () => {
  it('Free plan features match actual implementation', () => {
    const features = PLANS.free.features;
    expect(features.find(f => f.label === 'Up to 3 invoices per month')?.included).toBe(true);
    expect(features.find(f => f.label === 'Voice invoicing')?.included).toBe(true);
    expect(features.find(f => f.label === 'PDF export')?.included).toBe(true);
    expect(features.find(f => f.label === 'Client management')?.included).toBe(true);
    expect(features.find(f => f.label === 'Email sending')?.included).toBe(false);
    expect(features.find(f => f.label === 'Direct payments (Stripe)')?.included).toBe(false);
    expect(features.find(f => f.label === 'Custom branding')?.included).toBe(false);
  });

  it('Pro plan features match actual implementation', () => {
    const features = PLANS.pro.features;
    expect(features.find(f => f.label === 'Up to 50 invoices per month')?.included).toBe(true);
    expect(features.find(f => f.label === 'Email invoices directly to clients')?.included).toBe(true);
    expect(features.find(f => f.label === 'Direct payments via Stripe')?.included).toBe(true);
    expect(features.find(f => f.label === 'Custom branding')?.included).toBe(false);
    expect(features.find(f => f.label === 'Priority support')?.included).toBe(false);
  });

  it('Business plan features match actual implementation', () => {
    const features = PLANS.business.features;
    expect(features.find(f => f.label === 'Unlimited invoices')?.included).toBe(true);
    expect(features.find(f => f.label === 'Custom branding (logo, colors)')?.included).toBe(true);
    expect(features.find(f => f.label === 'Priority support')?.included).toBe(true);
    expect(features.find(f => f.label === 'Dedicated account manager')?.included).toBe(false);
  });

  it('Enterprise plan features match actual implementation', () => {
    const features = PLANS.enterprise.features;
    expect(features.find(f => f.label === 'Dedicated account manager')?.included).toBe(true);
    expect(features.find(f => f.label === 'Unlimited invoices')?.included).toBe(true);
    expect(features.find(f => f.label === 'Custom branding (logo, colors)')?.included).toBe(true);
    expect(features.find(f => f.label === 'Priority support')?.included).toBe(true);
  });

  it('Enterprise plan marks unimplemented features as Coming soon', () => {
    const features = PLANS.enterprise.features;
    const teamFeature = features.find(f => f.label === 'Team collaboration');
    expect(teamFeature?.included).toBe(false);
    expect(teamFeature?.comingSoon).toBe(true);

    const apiFeature = features.find(f => f.label === 'API access');
    expect(apiFeature?.included).toBe(false);
    expect(apiFeature?.comingSoon).toBe(true);

    const integrationFeature = features.find(f => f.label === 'Custom integrations');
    expect(integrationFeature?.included).toBe(false);
    expect(integrationFeature?.comingSoon).toBe(true);
  });

  it('Business plan is marked as Most Popular', () => {
    expect(PLANS.business.popular).toBe(true);
  });

  it('Only Business is marked as popular', () => {
    expect(PLANS.free.popular).toBeUndefined();
    expect(PLANS.pro.popular).toBeUndefined();
    expect(PLANS.enterprise.popular).toBeUndefined();
  });

  it('Pro plan uses "Everything in Free, plus:" as first feature', () => {
    expect(PLANS.pro.features[0].label).toBe('Everything in Free, plus:');
  });

  it('Business plan uses "Everything in Pro, plus:" as first feature', () => {
    expect(PLANS.business.features[0].label).toBe('Everything in Pro, plus:');
  });

  it('Enterprise plan uses "Everything in Business, plus:" as first feature', () => {
    expect(PLANS.enterprise.features[0].label).toBe('Everything in Business, plus:');
  });
});

describe('plan taglines and bestFor labels', () => {
  it('Free: "Start invoicing professionally"', () => {
    expect(PLANS.free.tagline).toBe('Start invoicing professionally');
  });

  it('Pro: "Get paid faster"', () => {
    expect(PLANS.pro.tagline).toBe('Get paid faster');
  });

  it('Business: "Run the whole operation"', () => {
    expect(PLANS.business.tagline).toBe('Run the whole operation');
  });

  it('Enterprise: "Scale with control"', () => {
    expect(PLANS.enterprise.tagline).toBe('Scale with control');
  });

  it('Each plan has a bestFor label', () => {
    expect(PLANS.free.bestFor).toBeTruthy();
    expect(PLANS.pro.bestFor).toBeTruthy();
    expect(PLANS.business.bestFor).toBeTruthy();
    expect(PLANS.enterprise.bestFor).toBeTruthy();
  });
});

describe('no nonexistent features advertised as included', () => {
  it('does not advertise "Advanced automation" as included anywhere', () => {
    for (const plan of Object.values(PLANS)) {
      const feature = plan.features.find(f => f.label.includes('Advanced automation'));
      if (feature) {
        expect(feature.included).toBe(false);
      }
    }
  });

  it('does not advertise "SLA guarantee" as included anywhere', () => {
    for (const plan of Object.values(PLANS)) {
      const feature = plan.features.find(f => f.label.includes('SLA'));
      if (feature) {
        expect(feature.included).toBe(false);
      }
    }
  });

  it('does not advertise "Custom onboarding" as included anywhere', () => {
    for (const plan of Object.values(PLANS)) {
      const feature = plan.features.find(f => f.label.includes('Custom onboarding'));
      if (feature) {
        expect(feature.included).toBe(false);
      }
    }
  });
});
