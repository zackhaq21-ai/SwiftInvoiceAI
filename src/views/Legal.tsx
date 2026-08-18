import { Shield, FileText, CreditCard, Mail, ArrowLeft } from 'lucide-react';
import type { View } from '@/App';

interface LegalProps {
  page: string;
  onNavigate: (view: View) => void;
}

const PAGES: Record<string, { title: string; icon: typeof Shield; lastUpdated: string; sections: { heading: string; body: string[] }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    icon: Shield,
    lastUpdated: 'August 2026',
    sections: [
      {
        heading: 'Overview',
        body: [
          'Swift Invoice AI ("we", "us", "our") is an invoicing application that helps businesses create, send, and manage invoices, estimates, and payments. This Privacy Policy explains how we collect, use, and protect your information.',
          'By using Swift Invoice AI, you agree to the practices described in this policy.',
        ],
      },
      {
        heading: 'Information We Collect',
        body: [
          'Account information: Your email address and encrypted password, needed for authentication.',
          'Business profile information: Your business name, address, phone, logo, and invoice preferences that you choose to provide.',
          'Invoice and client data: Invoice details, line items, client contact information, and payment records that you create.',
          'Usage data: We log basic usage patterns (such as features used and actions taken) for service improvement and audit purposes.',
          'Payment data: Payment processing is handled by Stripe. We do not store your credit card details — Stripe tokenizes and secures all card information.',
        ],
      },
      {
        heading: 'How We Use Your Information',
        body: [
          'To provide and maintain the invoicing service, including creating, sending, and tracking invoices.',
          'To process subscription payments and manage your plan.',
          'To send transactional emails (invoice delivery, payment confirmations, password resets).',
          'To improve our features, user experience, and service reliability.',
          'To detect, prevent, and address fraud, abuse, and security issues.',
        ],
      },
      {
        heading: 'Data Sharing',
        body: [
          'We do not sell your data. We share data only with service providers that help us operate (Stripe for payments, Resend for email delivery, Supabase for data hosting) — each under their own privacy and security commitments.',
          'We may disclose information if required by law or to protect our rights and the safety of others.',
        ],
      },
      {
        heading: 'Data Retention and Deletion',
        body: [
          'Your data is retained as long as your account is active. You can request a full data export or account deletion at any time by contacting our support team.',
          'Upon account deletion, your business profile, invoices, clients, and associated data are permanently removed within 30 days.',
          'Voice recordings and transcripts used for AI invoice generation are processed transiently and are not stored long-term unless you explicitly save the resulting invoice.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'All data is encrypted in transit (TLS/HTTPS) and at rest. Passwords are hashed using industry-standard algorithms by our authentication provider (Supabase).',
          'Row-level security policies ensure each user can only access their own data. Service-role keys are never exposed to the browser.',
          'Stripe webhook signatures are verified to prevent tampering. Audit logs track sensitive actions.',
        ],
      },
      {
        heading: 'Your Rights',
        body: [
          'Access: You can view all your data through the app at any time.',
          'Export: You can export your invoice and client data. Contact support for a full data export.',
          'Deletion: You can delete your account and all associated data. Contact support or use the in-app deletion workflow.',
          'Opt-out: You can unsubscribe from marketing emails at any time. Transactional emails (invoice delivery, password resets) are sent as part of the service and cannot be opted out of.',
        ],
      },
      {
        heading: 'Contact',
        body: [
          'For privacy questions or data requests, contact us at: [support email — to be configured by the business owner].',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    icon: FileText,
    lastUpdated: 'August 2026',
    sections: [
      {
        heading: 'Acceptance of Terms',
        body: [
          'By creating an account or using Swift Invoice AI, you agree to these Terms of Service. If you do not agree, you may not use the service.',
          'You must be at least 18 years old and have the legal authority to bind your business to these terms.',
        ],
      },
      {
        heading: 'Your Account',
        body: [
          'You are responsible for maintaining the security of your account credentials and for all activities under your account.',
          'You must provide accurate business information when creating invoices, as these documents may have legal and tax implications.',
        ],
      },
      {
        heading: 'Acceptable Use',
        body: [
          'You agree to use Swift Invoice AI only for lawful business purposes. You may not use the service to create fraudulent invoices, misrepresent goods or services, or violate any applicable laws.',
          'You retain ownership of all invoice and client data you create. You are responsible for the accuracy and legality of your invoices.',
        ],
      },
      {
        heading: 'Subscription Plans and Billing',
        body: [
          'Swift Invoice AI offers Free, Pro ($14.99/mo), Business ($29.99/mo), and Enterprise ($99.99/mo) plans. Prices are in USD and billed monthly through Stripe.',
          'You can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at the next billing cycle.',
          'Failed payments may result in suspended service until payment is resolved. You will be notified by email before any suspension.',
        ],
      },
      {
        heading: 'Intellectual Property',
        body: [
          'Swift Invoice AI and its software, design, and branding are the property of their respective owners. You may not copy, modify, or redistribute the platform itself.',
          'Invoices, estimates, and documents you create belong to you and your business.',
        ],
      },
      {
        heading: 'Disclaimers and Limitation of Liability',
        body: [
          'Swift Invoice AI is provided "as is" without warranties of any kind. We do not guarantee that the service will be error-free, uninterrupted, or that invoices generated through AI features will be legally compliant in your jurisdiction.',
          'You should review all AI-generated content before sending invoices to clients.',
          'Our liability is limited to the amount you have paid in the preceding 12 months.',
        ],
      },
      {
        heading: 'Termination',
        body: [
          'You can close your account at any time. We may suspend or terminate accounts that violate these terms or pose a security risk.',
        ],
      },
      {
        heading: 'Contact',
        body: [
          'For questions about these terms, contact: [support email — to be configured by the business owner].',
        ],
      },
    ],
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    icon: CreditCard,
    lastUpdated: 'August 2026',
    sections: [
      {
        heading: 'Cancellation',
        body: [
          'You can cancel your Swift Invoice AI subscription at any time from your account settings or by contacting support.',
          'Cancellation takes effect at the end of your current billing period. You will retain access to paid features until then.',
          'No cancellation fees apply.',
        ],
      },
      {
        heading: 'Refunds',
        body: [
          'Monthly subscriptions are non-refundable once billed. However, if you cancel within 48 hours of a renewal charge and have not used paid features since the charge, contact support for a full refund of that billing cycle.',
          'Annual subscriptions (if offered) may be refunded on a prorated basis for unused months, minus a 10% administrative fee.',
          'Refunds are processed back to the original payment method within 5-10 business days.',
        ],
      },
      {
        heading: 'Downgrades',
        body: [
          'When you downgrade from a higher plan to a lower plan, the change takes effect at the next billing cycle. No partial refunds are issued for the current period.',
        ],
      },
      {
        heading: 'Failed Payments',
        body: [
          'If a payment fails, we will retry it over a grace period. Your subscription will move to "past_due" status. You will be notified by email and given the opportunity to update your payment method.',
          'If payment is not resolved within 14 days, your subscription will be cancelled and your account will revert to the Free plan.',
        ],
      },
      {
        heading: 'Contact',
        body: [
          'For refund requests or cancellation assistance, contact: [support email — to be configured by the business owner].',
        ],
      },
    ],
  },
  contact: {
    title: 'Contact & Support',
    icon: Mail,
    lastUpdated: 'August 2026',
    sections: [
      {
        heading: 'Get Help',
        body: [
          'We are here to help. Whether you have a question about a feature, need help with your invoice, or want to report an issue, we want to hear from you.',
        ],
      },
      {
        heading: 'Support Channels',
        body: [
          'Email: [support email — to be configured by the business owner]',
          'Priority support is available for Business and Enterprise plan subscribers.',
          'Enterprise plan subscribers have access to a dedicated account manager.',
        ],
      },
      {
        heading: 'Privacy & Data Requests',
        body: [
          'For privacy concerns, data export requests, or account deletion requests, please contact us at the support email above with the subject line "Privacy Request".',
          'We will respond to all privacy requests within 30 days.',
        ],
      },
      {
        heading: 'Business Information',
        body: [
          'Legal business name: [to be configured by the business owner]',
          'Registered address: [to be configured by the business owner]',
          'Tax ID: [to be configured by the business owner]',
          'Jurisdiction: [to be configured by the business owner]',
        ],
      },
      {
        heading: 'Bug Reports & Feature Requests',
        body: [
          'Found a bug or have an idea? We welcome your feedback. Send details to our support email and we will triage it promptly.',
        ],
      },
    ],
  },
};

export default function Legal({ page, onNavigate }: LegalProps) {
  const content = PAGES[page] || PAGES.privacy;
  const Icon = content.icon;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center gap-4">
          <button
            onClick={() => onNavigate({ name: 'dashboard' })}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors min-touch p-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10 pb-20">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{content.title}</h1>
        </div>
        <p className="text-sm text-slate-400 mb-10">Last updated: {content.lastUpdated}</p>

        <div className="space-y-8">
          {content.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-slate-900 mb-3">{section.heading}</h2>
              <div className="space-y-3">
                {section.body.map((para, j) => (
                  <p key={j} className="text-sm text-slate-600 leading-relaxed">{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <div className="flex flex-wrap gap-x-4 gap-y-3 text-sm">
            {Object.entries(PAGES).map(([key, val]) => (
              key !== page && (
                <button
                  key={key}
                  onClick={() => onNavigate({ name: 'legal', page: key })}
                  className="text-slate-500 hover:text-slate-900 transition-colors min-touch p-1"
                >
                  {val.title}
                </button>
              )
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-6">
            &copy; {new Date().getFullYear()} Swift Invoice AI. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
