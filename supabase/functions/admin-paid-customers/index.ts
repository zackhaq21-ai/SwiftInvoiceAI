import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

// Service-role client for admin_users lookup (RLS-protected table, SECURITY DEFINER
// function uses auth.uid() which needs a user-scoped client — see below).
const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PlanPriceMap {
  [priceId: string]: string;
}

function buildPriceMap(): PlanPriceMap {
  const map: PlanPriceMap = {};
  const pro = Deno.env.get("STRIPE_PRICE_PRO");
  const business = Deno.env.get("STRIPE_PRICE_BUSINESS");
  const enterprise = Deno.env.get("STRIPE_PRICE_ENTERPRISE");
  if (pro) map[pro] = "Pro";
  if (business) map[business] = "Business";
  if (enterprise) map[enterprise] = "Enterprise";
  return map;
}

interface SanitizedCustomer {
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

function epochToISO(epoch: number | null | undefined): string | null {
  if (!epoch || typeof epoch !== "number") return null;
  const d = new Date(epoch * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function checkAdmin(userToken: string): Promise<boolean> {
  // The is_current_user_admin() SECURITY DEFINER function uses auth.uid(),
  // which resolves from the request's JWT. A service-role client has no user
  // context (auth.uid() returns NULL), so the check would always fail.
  // Use a user-scoped client built with the caller's access token.
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  });
  const { data } = await userClient.rpc("is_current_user_admin");
  return data === true;
}

async function fetchAllSubscriptions(stripeKey: string, priceMap: PlanPriceMap): Promise<SanitizedCustomer[]> {
  const results: SanitizedCustomer[] = [];
  let hasMore = true;
  let startingAfter = "";

  while (hasMore) {
    let url = "https://api.stripe.com/v1/subscriptions?limit=100&status=all&expand[]=data.customer&expand[]=data.latest_invoice&expand[]=data.default_payment_method";
    if (startingAfter) url += `&starting_after=${encodeURIComponent(startingAfter)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error?.message || "Stripe API error");
    }

    const subs = body.data || [];
    for (const sub of subs) {
      const customer = sub.customer;
      const customerObj = typeof customer === "object" ? customer : null;
      const customerId = typeof customer === "string" ? customer : customerObj?.id ?? "";

      const latestInvoice = sub.latest_invoice;
      const invoiceObj = typeof latestInvoice === "object" ? latestInvoice : null;
      const invoiceStatus = invoiceObj?.status ?? null;
      const amountPaid = invoiceObj?.amount_paid ?? 0;
      const currency = invoiceObj?.currency ?? "usd";
      const paidAt = invoiceObj?.status_transitions?.paid_at ?? invoiceObj?.paid_at ?? null;

      const priceId = sub.items?.data?.[0]?.price?.id ?? "";
      const planName = priceMap[priceId] ?? "Unknown";

      const pm = sub.default_payment_method;
      const pmObj = typeof pm === "object" ? pm : null;
      const cardBrand = pmObj?.card?.brand ?? null;
      const cardLast4 = pmObj?.card?.last4 ?? null;

      const isActuallyPaid = invoiceStatus === "paid" && amountPaid > 0;

      results.push({
        email: customerObj?.email ?? null,
        name: customerObj?.name ?? null,
        plan: planName,
        subscription_status: sub.status ?? "unknown",
        latest_invoice_status: invoiceStatus,
        amount_paid: amountPaid,
        currency: currency,
        created_date: epochToISO(sub.created),
        paid_date: epochToISO(paidAt),
        next_renewal_date: epochToISO(sub.current_period_end),
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id ?? "",
        card_brand: cardBrand,
        card_last4: cardLast4,
        is_actually_paid: isActuallyPaid,
      });
    }

    hasMore = body.has_more === true;
    if (hasMore && subs.length > 0) {
      startingAfter = subs[subs.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return respond({ error: "Method not allowed. Use GET." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseService.auth.getUser(token);
    if (authErr || !user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const isAdmin = await checkAdmin(token);
    if (!isAdmin) {
      return respond({ error: "Forbidden. Admin access required." }, 403);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return respond({ error: "Stripe is not configured." }, 500);
    }

    const priceMap = buildPriceMap();
    const customers = await fetchAllSubscriptions(stripeKey, priceMap);

    const summary = {
      total: customers.length,
      actually_paid: customers.filter(c => c.is_actually_paid).length,
      active: customers.filter(c => c.subscription_status === "active").length,
      past_due: customers.filter(c => c.subscription_status === "past_due").length,
      canceled: customers.filter(c => c.subscription_status === "canceled").length,
      incomplete: customers.filter(c => c.subscription_status === "incomplete" || c.subscription_status === "incomplete_expired").length,
      trialing: customers.filter(c => c.subscription_status === "trialing").length,
      monthly_recurring_revenue: customers
        .filter(c => c.is_actually_paid && c.subscription_status === "active")
        .reduce((sum, c) => sum + c.amount_paid, 0),
      currency: "usd",
    };

    return respond({ customers, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
    return respond({ error: msg }, 500);
  }
});
