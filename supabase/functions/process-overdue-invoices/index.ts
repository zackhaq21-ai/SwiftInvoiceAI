import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface OverdueInvoiceRow {
  id: string;
  invoice_number: string;
}

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
    // Authenticate via CRON_SECRET — this function is intended for
    // scheduled/cron execution only, not public access.
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader?.replace("Bearer ", "");
    if (token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toISOString().split("T")[0];

    // Find overdue invoices that are not paid and past due date
    const { data: overdueInvoices, error } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        client_name,
        client_email,
        total,
        due_date,
        user_id,
        business_profile:user_id (
          name,
          email,
          accent_color,
          currency_symbol
        )
      `)
      .eq("status", "sent")
      .lt("due_date", today)
      .not("client_email", "is", null)
      .eq("document_type", "invoice");

    if (error) throw error;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue invoices found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark invoices as overdue
    const overdueIds = (overdueInvoices as OverdueInvoiceRow[]).map((inv) => inv.id);
    await supabase
      .from("invoices")
      .update({ status: "overdue" })
      .in("id", overdueIds);

    return new Response(
      JSON.stringify({
        message: `Processed ${overdueInvoices.length} overdue invoices`,
        sent: overdueInvoices.length,
        invoiceNumbers: (overdueInvoices as OverdueInvoiceRow[]).map((inv) => inv.invoice_number),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to process overdue invoices" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
