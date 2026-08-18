export interface PaidCustomerRow {
  email: string | null;
  name: string | null;
  plan: string;
  subscription_status: string;
  latest_invoice_status: string | null;
  amount_paid: number;
  currency: string;
  created_date: string | null;
  paid_date: string | null;
  next_renewal_date: string | null;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  card_brand: string | null;
  card_last4: string | null;
  is_actually_paid: boolean;
}

export interface PaidCustomersResponse {
  customers: PaidCustomerRow[];
  summary: {
    total: number;
    actually_paid: number;
    active: number;
    past_due: number;
    canceled: number;
    incomplete: number;
    trialing: number;
    monthly_recurring_revenue: number;
    currency: string;
  };
}

/**
 * Maps a Stripe price ID to a human-readable plan name using the project's
 * STRIPE_PRICE_* env vars. Falls back to "Unknown" for unrecognized prices.
 */
export function mapPriceIdToPlan(
  priceId: string,
  priceMap: Record<string, string>,
): string {
  return priceMap[priceId] ?? "Unknown";
}

/**
 * Determines whether a customer has actually paid based on the rule:
 * the latest subscription invoice must have status "paid" AND amount_paid > 0.
 */
export function isActuallyPaid(
  latestInvoiceStatus: string | null,
  amountPaid: number,
): boolean {
  return latestInvoiceStatus === "paid" && amountPaid > 0;
}

/**
 * Returns the default price map built from Vite env vars (client-side).
 * The edge function uses Deno.env.get directly; this is for client reference only.
 */
export function getClientPriceMap(): Record<string, string> {
  const map: Record<string, string> = {};
  const pro = import.meta.env.VITE_STRIPE_PRICE_PRO;
  const business = import.meta.env.VITE_STRIPE_PRICE_BUSINESS;
  const enterprise = import.meta.env.VITE_STRIPE_PRICE_ENTERPRISE;
  if (pro) map[pro] = "Pro";
  if (business) map[business] = "Business";
  if (enterprise) map[enterprise] = "Enterprise";
  return map;
}
