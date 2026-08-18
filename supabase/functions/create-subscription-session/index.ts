import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PLAN_NAMES: Record<string, string> = {
  pro: "Swift Invoice AI Pro",
  business: "Swift Invoice AI Business",
  enterprise: "Swift Invoice AI Enterprise",
};

const PLAN_AMOUNTS: Record<string, number> = {
  pro: 1499,
  business: 2999,
  enterprise: 9999,
};

const BLOCKING_STATUSES = new Set([
  "active", "trialing", "past_due", "unpaid", "incomplete",
]);

function isBlockingStatus(status: string): boolean {
  return BLOCKING_STATUSES.has(status);
}

const LOCK_TTL_MINUTES = 10;

interface StripeSubscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  customer: string;
}

async function getStripeSubscriptionsForCustomer(
  stripeKey: string,
  customerId: string,
): Promise<StripeSubscription[]> {
  const results: StripeSubscription[] = [];
  let hasMore = true;
  let startingAfter = "";

  while (hasMore) {
    let url = `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&limit=100&status=all`;
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
      results.push({
        id: sub.id,
        status: sub.status,
        cancel_at_period_end: sub.cancel_at_period_end === true,
        customer: typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? customerId,
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

async function resolveAllCustomerIds(
  stripeKey: string,
  userId: string,
): Promise<string[]> {
  const customerIds = new Set<string>();

  const { data: localCustomers } = await supabase
    .from("stripe_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (localCustomers) {
    for (const row of localCustomers) {
      if (row.customer_id) customerIds.add(row.customer_id);
    }
  }

  let hasMore = true;
  let nextCursor: string | undefined;

  while (hasMore) {
    const searchParams = new URLSearchParams({
      limit: "100",
      query: `metadata['user_id']:'${userId}'`,
    });
    if (nextCursor) {
      searchParams.set("page", nextCursor);
    }

    const searchRes = await fetch("https://api.stripe.com/v1/customers/search", {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
      body: searchParams,
    });

    const searchBody = await searchRes.json();
    if (searchRes.ok && searchBody.data) {
      for (const cust of searchBody.data) {
        if (cust.id) customerIds.add(cust.id);
      }
      hasMore = searchBody.has_more === true;
      nextCursor = searchBody.next_page;
    } else {
      hasMore = false;
    }
  }

  return Array.from(customerIds);
}

async function findBlockingSubscription(
  stripeKey: string,
  customerIds: string[],
): Promise<StripeSubscription | null> {
  for (const customerId of customerIds) {
    const subs = await getStripeSubscriptionsForCustomer(stripeKey, customerId);
    for (const sub of subs) {
      if (isBlockingStatus(sub.status)) {
        return sub;
      }
      if (sub.status === "active" && sub.cancel_at_period_end) {
        return sub;
      }
    }
  }
  return null;
}

/**
 * Generates a crypto-random UUID for idempotency keys.
 * Each checkout attempt gets a unique key so a canceled customer can
 * repurchase later without Stripe returning a cached old session.
 */
function generateIdempotencySuffix(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const { plan, successUrl, cancelUrl } = await req.json();
    if (!plan || !["pro", "business", "enterprise"].includes(plan)) {
      return respond({ error: `Invalid plan. Must be "pro", "business", or "enterprise".` }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return respond({ error: "Payment processing is not configured." }, 500);
    }

    const priceId = plan === "pro"
      ? Deno.env.get("STRIPE_PRICE_PRO")
      : plan === "business"
        ? Deno.env.get("STRIPE_PRICE_BUSINESS")
        : Deno.env.get("STRIPE_PRICE_ENTERPRISE");

    // ============================================================
    // DEFENSE LAYER 1: Server-side live Stripe duplicate check
    // ============================================================
    const customerIds = await resolveAllCustomerIds(stripeKey, user.id);
    const blockingSub = await findBlockingSubscription(stripeKey, customerIds);

    if (blockingSub) {
      return respond({
        error: "You already have an active subscription. Use Manage Billing to modify it.",
        code: "SUBSCRIPTION_EXISTS",
        existing_subscription: {
          status: blockingSub.status,
          cancel_at_period_end: blockingSub.cancel_at_period_end,
        },
      }, 409);
    }

    // ============================================================
    // DEFENSE LAYER 2: Per-user concurrency lock + session persistence
    // One lock per user across ALL plans. Pending sessions are reused.
    // ============================================================

    // Check for an existing lock for this user
    const { data: existingLock } = await supabase
      .from("checkout_locks")
      .select("id, checkout_session_id, checkout_url, plan, status, expires_at, idempotency_key")
      .eq("user_id", user.id)
      .maybeSingle();

    const now = new Date();
    const nowIso = now.toISOString();

    if (existingLock) {
      const isExpired = existingLock.expires_at && new Date(existingLock.expires_at).getTime() <= now.getTime();
      const isFailed = existingLock.status === "failed";
      const isCompleted = existingLock.status === "completed";

      // If completed or still pending and not expired, reuse or block
      if (isCompleted) {
        // Lock was completed by webhook — clean it up and allow new checkout
        await supabase.from("checkout_locks").delete().eq("id", existingLock.id);
      } else if (isFailed || isExpired) {
        // Stale/failed lock — clean it up and proceed to create new
        await supabase.from("checkout_locks").delete().eq("id", existingLock.id);
      } else if (existingLock.status === "pending" && existingLock.checkout_url) {
        // Pending session exists — reuse it if same plan, block if different plan
        if (existingLock.plan === plan) {
          return respond({
            url: existingLock.checkout_url,
            reused: true,
          });
        }
        // Different plan checkout in progress — block
        return respond({
          error: "A checkout is already in progress for another plan. Please complete or cancel it first.",
          code: "CHECKOUT_IN_PROGRESS",
        }, 409);
      } else if (existingLock.status === "pending" && !existingLock.checkout_url) {
        // Lock exists but no session yet (race: another request is mid-creation)
        return respond({
          error: "A checkout is already in progress. Please wait a moment and try again.",
          code: "CHECKOUT_IN_PROGRESS",
        }, 409);
      }
    }

    // Clean up any expired locks for this user (defensive)
    await supabase
      .from("checkout_locks")
      .delete()
      .eq("user_id", user.id)
      .lte("expires_at", nowIso);

    // Acquire per-user lock with attempt-specific idempotency key
    const idempotencyKey = `checkout_${user.id}_${plan}_${generateIdempotencySuffix()}`;
    const lockExpiresAt = new Date(Date.now() + LOCK_TTL_MINUTES * 60 * 1000).toISOString();

    const { error: lockErr } = await supabase
      .from("checkout_locks")
      .insert({
        user_id: user.id,
        plan: plan,
        status: "pending",
        expires_at: lockExpiresAt,
        idempotency_key: idempotencyKey,
      });

    if (lockErr) {
      if (lockErr.code === "23505") {
        return respond({
          error: "A checkout is already in progress. Please wait a moment and try again.",
          code: "CHECKOUT_IN_PROGRESS",
        }, 409);
      }
      return respond({ error: "Unable to process request. Please try again." }, 500);
    }

    // Fetch the lock row we just created (to get its id for updates)
    const { data: lockRow } = await supabase
      .from("checkout_locks")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    try {
      // ============================================================
      // Resolve or create the canonical Stripe customer
      // ============================================================
      const { data: existing, error: lookupErr } = await supabase
        .from("stripe_customers")
        .select("customer_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();

      if (lookupErr) {
        throw new Error("Unable to process request. Please try again.");
      }

      let customerId = existing?.customer_id as string | undefined;

      if (!customerId) {
        const custRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: user.email ?? "",
            "metadata[user_id]": user.id,
          }),
        });

        const custBody = await custRes.json();
        if (!custRes.ok) {
          throw new Error("Unable to set up payment account. Please try again.");
        }
        customerId = custBody.id;

        const { error: custInsertErr } = await supabase
          .from("stripe_customers")
          .upsert({ user_id: user.id, customer_id: customerId }, { onConflict: "user_id" });

        if (custInsertErr) {
          throw new Error("Unable to save payment account. Please try again.");
        }
      }

      const origin = req.headers.get("origin") ?? "https://app.swiftinvoiceai.app";
      const params = new URLSearchParams({
        mode: "subscription",
        customer: customerId!,
        "payment_method_types[0]": "card",
        success_url: successUrl || `${origin}?subscribed=true`,
        cancel_url: cancelUrl || origin,
        "metadata[user_id]": user.id,
        "metadata[plan]": plan,
        "metadata[checkout_lock_id]": lockRow?.id ?? "",
        "subscription_data[metadata][user_id]": user.id,
        "subscription_data[metadata][plan]": plan,
      });

      if (priceId) {
        params.append("line_items[0][price]", priceId);
        params.append("line_items[0][quantity]", "1");
      } else {
        params.append("line_items[0][quantity]", "1");
        params.append("line_items[0][price_data][currency]", "usd");
        params.append("line_items[0][price_data][unit_amount]", String(PLAN_AMOUNTS[plan]));
        params.append("line_items[0][price_data][recurring][interval]", "month");
        params.append("line_items[0][price_data][product_data][name]", PLAN_NAMES[plan]);
      }

      // ============================================================
      // Create Stripe Checkout session with attempt-specific idempotency key
      // ============================================================
      const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Idempotency-Key": idempotencyKey,
        },
        body: params,
      });

      const sessionBody = await sessionRes.json();
      if (!sessionRes.ok) {
        const errMsg = sessionBody?.error?.message || "Checkout session failed.";
        throw new Error(errMsg);
      }

      // ============================================================
      // Persist the session in the lock row — do NOT release it.
      // The lock stays until the webhook clears it (checkout.session.completed)
      // or it expires (TTL). A repeated request will reuse this session.
      // ============================================================
      if (lockRow?.id) {
        await supabase
          .from("checkout_locks")
          .update({
            checkout_session_id: sessionBody.id,
            checkout_url: sessionBody.url,
          })
          .eq("id", lockRow.id);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "checkout_session_created",
        entity_type: "subscription",
        entity_id: sessionBody.id,
        details: { plan, idempotency_key: idempotencyKey },
      });

      return respond({ url: sessionBody.url });
    } catch (err) {
      // On failure, release the lock so the user can retry
      if (lockRow?.id) {
        await supabase
          .from("checkout_locks")
          .delete()
          .eq("id", lockRow.id);
      }
      throw err;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
    return respond({ error: msg }, 500);
  }
});
