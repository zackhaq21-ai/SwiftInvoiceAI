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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Unauthorized" }, 401);

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return respond({ error: "Unauthorized" }, 401);

    const { action } = await req.json();
    if (!action || !["cancel", "resume"].includes(action)) {
      return respond({ error: "Invalid action. Must be 'cancel' or 'resume'." }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return respond({ error: "Payment processing is not configured." }, 500);
    }

    // Look up the Stripe customer ID owned by this user — never trust client-provided IDs
    const { data: customerRow, error: custErr } = await supabase
      .from("stripe_customers")
      .select("customer_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (custErr || !customerRow?.customer_id) {
      return respond({ error: "No active subscription found for your account." }, 404);
    }

    const customerId = customerRow.customer_id as string;

    // Fetch the subscription from Stripe by customer ID (not from client)
    const subListRes = await fetch(
      `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}&limit=1&status=all`,
      {
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const subList = await subListRes.json();
    if (!subListRes.ok) {
      return respond({ error: "Unable to retrieve subscription details. Please try again." }, 502);
    }

    if (!subList.data || subList.data.length === 0) {
      return respond({ error: "No active subscription found." }, 404);
    }

    const subscription = subList.data[0];
    const subscriptionId = subscription.id;

    if (action === "cancel") {
      // Only allow canceling active subscriptions
      if (!["active", "trialing"].includes(subscription.status)) {
        return respond({ error: "Only active subscriptions can be cancelled." }, 400);
      }
      if (subscription.cancel_at_period_end) {
        return respond({ error: "Cancellation is already scheduled." }, 409);
      }

      // Idempotency key based on user + subscription + action
      const idempotencyKey = `cancel_${user.id}_${subscriptionId}`;

      const cancelRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": idempotencyKey,
          },
          body: new URLSearchParams({
            "cancel_at_period_end": "true",
          }),
        },
      );

      const cancelBody = await cancelRes.json();
      if (!cancelRes.ok) {
        const msg = cancelBody?.error?.message || "Failed to cancel subscription.";
        return respond({ error: msg }, 502);
      }

      // Update local state from verified Stripe response
      const periodEnd = cancelBody.current_period_end;
      await supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: true,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await supabase.from("stripe_subscriptions").upsert({
        customer_id: customerId,
        subscription_id: subscriptionId,
        cancel_at_period_end: true,
        current_period_end: periodEnd,
        status: cancelBody.status,
      }, { onConflict: "customer_id" });

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "subscription_cancel_scheduled",
        entity_type: "subscription",
        entity_id: subscriptionId,
        details: { period_end: periodEnd },
      });

      return respond({
        success: true,
        cancel_at_period_end: true,
        current_period_end: periodEnd,
      });
    }

    if (action === "resume") {
      // Only allow resuming if cancellation is scheduled
      if (!subscription.cancel_at_period_end) {
        return respond({ error: "No scheduled cancellation to undo." }, 400);
      }

      const idempotencyKey = `resume_${user.id}_${subscriptionId}`;

      const resumeRes = await fetch(
        `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": idempotencyKey,
          },
          body: new URLSearchParams({
            "cancel_at_period_end": "false",
          }),
        },
      );

      const resumeBody = await resumeRes.json();
      if (!resumeRes.ok) {
        const msg = resumeBody?.error?.message || "Failed to resume subscription.";
        return respond({ error: msg }, 502);
      }

      const periodEnd = resumeBody.current_period_end;
      await supabase
        .from("subscriptions")
        .update({
          cancel_at_period_end: false,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      await supabase.from("stripe_subscriptions").upsert({
        customer_id: customerId,
        subscription_id: subscriptionId,
        cancel_at_period_end: false,
        current_period_end: periodEnd,
        status: resumeBody.status,
      }, { onConflict: "customer_id" });

      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "subscription_resumed",
        entity_type: "subscription",
        entity_id: subscriptionId,
        details: { period_end: periodEnd },
      });

      return respond({
        success: true,
        cancel_at_period_end: false,
        current_period_end: periodEnd,
      });
    }
  } catch (err) {
    return respond({ error: "An unexpected error occurred. Please try again." }, 500);
  }
});
