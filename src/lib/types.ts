export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'declined';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'partial';
export type SubscriptionTier = 'free' | 'pro' | 'business' | 'enterprise' | 'admin';

export type BusinessType = 'retail' | 'wholesale' | 'services' | 'trades' | 'boutique' | 'other';
export type ItemType = 'product' | 'service' | 'labor' | 'other';
export type IndustryTemplateId = 'general' | 'hvac' | 'plumbing' | 'electrical' | 'construction' | 'landscaping' | 'automotive' | 'cleaning' | 'retail' | 'wholesale' | 'boutique' | 'freelance' | 'consulting' | 'photography' | 'catering';

export type DocumentType = 'invoice' | 'estimate';
export type RecurringInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type PaymentMethod = 'cash' | 'card' | 'bank' | 'stripe' | 'other';

export interface BusinessProfile {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  tax_rate: number;
  currency: string;
  currency_symbol: string;
  invoice_prefix: string;
  next_invoice_number: number;
  notes: string | null;
  accent_color: string;
  business_type: BusinessType;
  industry_template: IndustryTemplateId;
  payments_enabled: boolean;
  hearth_merchant_url: string | null;
  hearth_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company: string | null;
  notes: string | null;
  tax_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  user_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  sort_order: number;
  item_type: ItemType;
  unit: string;
  tax_rate: number | null;
  discount_amount: number;
  notes: string | null;
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  user_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  work_order_number: string | null;
  technician_name: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  fees_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  warranty: string | null;
  metadata: Record<string, string> | null;
  industry_template: IndustryTemplateId | null;
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  payment_status: PaymentStatus;
  hearth_status: string | null;
  hearth_application_url: string | null;
  document_type: DocumentType;
  parent_invoice_id: string | null;
  estimate_number: string | null;
  deposit_amount: number;
  shipping_amount: number;
  recurring_enabled: boolean;
  recurring_interval: RecurringInterval | null;
  recurring_next_date: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItem[];
  invoice_payments?: InvoicePayment[];
  clients?: Pick<Client, 'id' | 'name' | 'email' | 'address'>;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  item_type: ItemType;
  category: string | null;
  sku: string | null;
  unit: string;
  unit_price: number;
  tax_rate: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  description: string;
  category: string;
  vendor: string | null;
  amount: number;
  expense_date: string;
  receipt_url: string | null;
  is_billable: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParsedVoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface ParsedVoiceInvoice {
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  clientAddress: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  workOrderNumber: string | null;
  technicianName: string | null;
  items: ParsedVoiceItem[];
  subtotal: number | null;
  taxRate: number | null;
  taxAmount: number | null;
  discount: number | null;
  fees: number | null;
  total: number | null;
  dueDate: string | null;
  terms: string | null;
  notes: string | null;
  warranty: string | null;
}
