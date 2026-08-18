import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const invoiceId = url.searchParams.get("invoiceId");

    if (!invoiceId || typeof invoiceId !== "string") {
      return new Response(JSON.stringify({ error: "Missing invoiceId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch only the minimal data needed to display the payment page.
    // Deliberately excludes: user_id, notes, terms, warranty, metadata,
    // client_address, client_phone, work_order_number, technician_name,
    // internal IDs, stripe IDs, and other private fields.
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        client_name,
        client_email,
        total,
        subtotal,
        tax_rate,
        tax_amount,
        discount_amount,
        due_date,
        issue_date,
        payment_status,
        status,
        document_type,
        business_profile!inner (
          name,
          logo_url,
          accent_color,
          currency_symbol,
          currency,
          payments_enabled
        )
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only invoices that are sent or overdue can be paid publicly
    if (invoice.document_type !== "invoice") {
      return new Response(JSON.stringify({ error: "This document is not payable" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch invoice items — only description, quantity, and total
    const { data: items } = await supabase
      .from("invoice_items")
      .select("description, quantity, total")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    return new Response(
      JSON.stringify({
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name,
          client_email: invoice.client_email,
          total: invoice.total,
          subtotal: invoice.subtotal,
          tax_rate: invoice.tax_rate,
          tax_amount: invoice.tax_amount,
          discount_amount: invoice.discount_amount,
          due_date: invoice.due_date,
          payment_status: invoice.payment_status,
        },
        business: invoice.business_profile,
        items: items || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
