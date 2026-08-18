import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { invoiceId } = await req.json();
    if (!invoiceId || typeof invoiceId !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid invoiceId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch only the columns needed for payment — no user_id, notes,
    // terms, internal metadata, client_address, client_phone, etc.
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        total,
        payment_status,
        document_type,
        status,
        business_profile!inner (
          name,
          payments_enabled,
          currency
        )
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only invoices (not estimates) that are in sent/overdue status can be paid
    if (invoice.document_type !== "invoice") {
      return new Response(JSON.stringify({ error: "This document is not payable" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.payment_status === "paid") {
      return new Response(JSON.stringify({ error: "This invoice has already been paid" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["sent", "overdue"].includes(invoice.status)) {
      return new Response(JSON.stringify({ error: "This invoice is not available for payment" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const business = invoice.business_profile;
    if (!business?.payments_enabled) {
      return new Response(JSON.stringify({ error: "Payments not enabled for this business" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Amount comes from the database, never from the browser
    const totalCents = Math.round(Number(invoice.total) * 100);
    if (totalCents < 50) {
      return new Response(JSON.stringify({ error: "Invoice total must be at least $0.50" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "https://example.com";
    const businessName = business.name || "Invoice Payment";

    // Create a Checkout Session with a dynamic price line item
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append("payment_method_types[0]", "card");
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", (business.currency || "usd").toLowerCase());
    params.append("line_items[0][price_data][unit_amount]", String(totalCents));
    params.append("line_items[0][price_data][product_data][name]", `Invoice ${invoice.invoice_number}`);
    params.append("line_items[0][price_data][product_data][description]", `Payment for invoice ${invoice.invoice_number} from ${businessName}`);
    params.append("client_reference_id", invoice.id);
    params.append("success_url", `${origin}/pay/${invoice.id}?status=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${origin}/pay/${invoice.id}?status=cancelled`);
    // Metadata identifies the invoice for webhook processing
    params.append("metadata[invoice_id]", invoice.id);
    params.append("metadata[invoice_number]", invoice.invoice_number);
    params.append("metadata[expected_amount]", String(totalCents));

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!sessionRes.ok) {
      const errText = await sessionRes.text();
      return new Response(JSON.stringify({ error: `Stripe error: ${errText}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await sessionRes.json();

    // Record the session ID and mark payment as pending
    await supabase
      .from("invoices")
      .update({
        stripe_checkout_session_id: session.id,
        payment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    // Return only the checkout URL — no invoice data
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
