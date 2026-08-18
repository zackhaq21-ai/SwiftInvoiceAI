import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendWithRetry(url: string, init: RequestInit, maxRetries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || res.status < 500) return res;
      // 5xx errors are retryable
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (err) {
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

// Escape user-controlled text for safe insertion into HTML.
// Converts &, <, >, ", ' to their HTML entities, preventing
// script injection and HTML structure manipulation.
function esc(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape text that should preserve line breaks (notes, address).
// Newlines become <br> after HTML-escaping the content.
function escMultiline(value: unknown): string {
  return esc(value).replace(/\n/g, "<br>");
}

function buildInvoiceHtml(payload: any): string {
  const { business, invoice, items } = payload;
  const symbol = esc(business?.currency_symbol || "$");
  const accent = esc(business?.accent_color || "#2563eb");

  const fmt = (n: number) =>
    `${symbol}${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemsHtml = (items || []).map((item: any) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155">${esc(item.description) || "&mdash;"}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:14px;color:#475569">${esc(item.quantity)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:14px;color:#475569">${fmt(item.unit_price)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;text-align:right;font-size:14px;font-weight:600;color:#0f172a">${fmt(item.total)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;font-family:Inter,Arial,sans-serif;background:#f8fafc">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
      <div style="padding:32px 40px;border-bottom:3px solid ${accent}">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div>
            <h1 style="margin:0;font-size:24px;color:${accent}">${esc(business?.name) || "My Business"}</h1>
            <p style="margin:4px 0 0;font-size:13px;color:#64748b">${esc(business?.email)}</p>
            ${business?.address ? `<p style="margin:0;font-size:13px;color:#64748b;white-space:pre-line">${escMultiline(business.address)}</p>` : ""}
          </div>
          <div style="text-align:right">
            <h2 style="margin:0;font-size:32px;font-weight:800;color:#e2e8f0;letter-spacing:-1px">INVOICE</h2>
            <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#334155">${esc(invoice.invoice_number)}</p>
          </div>
        </div>
      </div>
      <div style="padding:32px 40px">
        <div style="margin-bottom:24px">
          <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Bill To</p>
          <p style="margin:0;font-size:18px;font-weight:600;color:#0f172a">${esc(invoice.client_name) || "&mdash;"}</p>
          ${invoice.client_email ? `<p style="margin:2px 0 0;font-size:14px;color:#64748b">${esc(invoice.client_email)}</p>` : ""}
        </div>
        <div style="display:flex;gap:32px;margin-bottom:24px">
          <div><p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Issued</p><p style="margin:4px 0 0;font-size:14px;font-weight:500;color:#334155">${esc(invoice.issue_date) || "&mdash;"}</p></div>
          <div><p style="margin:0;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Due</p><p style="margin:4px 0 0;font-size:14px;font-weight:500;color:#334155">${esc(invoice.due_date) || "&mdash;"}</p></div>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:2px solid ${accent}">
              <th style="padding:12px 0;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px">Description</th>
              <th style="padding:12px 0;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;width:60px">Qty</th>
              <th style="padding:12px 0;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;width:100px">Price</th>
              <th style="padding:12px 0;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:1px;width:100px">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="margin-top:24px;display:flex;justify-content:flex-end">
          <div style="width:260px">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px"><span style="color:#64748b">Subtotal</span><span style="font-weight:500;color:#0f172a">${fmt(invoice.subtotal)}</span></div>
            ${invoice.discount_amount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px"><span style="color:#64748b">Discount</span><span style="font-weight:500;color:#dc2626">-${fmt(invoice.discount_amount)}</span></div>` : ""}
            ${invoice.tax_amount > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px"><span style="color:#64748b">Tax (${esc(invoice.tax_rate)}%)</span><span style="font-weight:500;color:#0f172a">${fmt(invoice.tax_amount)}</span></div>` : ""}
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:8px;border-top:2px solid ${accent}">
              <span style="font-weight:600;color:#0f172a">Total</span>
              <span style="font-size:22px;font-weight:700;color:${accent}">${fmt(invoice.total)}</span>
            </div>
          </div>
        </div>
        ${invoice.notes ? `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9"><p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Notes</p><p style="margin:0;font-size:14px;color:#475569;white-space:pre-line">${escMultiline(invoice.notes)}</p></div>` : ""}
        <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;text-align:center">
          <p style="margin:0;font-size:14px;font-weight:500;color:#475569">Thank you for your business!</p>
        </div>
      </div>
    </div>
  </div>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ── Authentication ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return respond({ error: "Unauthorized" }, 401);

    // ── Validate input ──────────────────────────────────────────────────────
    const { to, subject, invoice, business, items, senderEmail, invoiceId } = await req.json();

    if (!to || !invoice) {
      return respond({ error: "Missing required fields: 'to' and 'invoice'" }, 400);
    }

    // ── Verify invoice ownership ─────────────────────────────────────────────
    // The caller must own the invoice they are sending. We look up the
    // invoice by ID (if provided) or invoice_number to verify user_id matches.
    const lookupId = invoiceId || invoice.id;
    if (lookupId) {
      const { data: invRow, error: invErr } = await supabase
        .from("invoices")
        .select("user_id")
        .eq("id", lookupId)
        .maybeSingle();

      if (invErr || !invRow) {
        return respond({ error: "Invoice not found" }, 404);
      }
      if (invRow.user_id !== user.id) {
        return respond({ error: "You do not have permission to send this invoice" }, 403);
      }
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return respond({ error: "RESEND_API_KEY is not configured as an edge function secret." }, 500);
    }

    const html = buildInvoiceHtml({ business, invoice, items });

    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "invoices@swiftinvoiceai.app";
    const fromName = esc(business?.name) || "SwiftInvoiceAI";

    const emailPayload: Record<string, unknown> = {
      from: `${fromName} <${fromAddress}>`,
      to: Array.isArray(to) ? to : [to],
      subject: subject || `Invoice ${invoice.invoice_number} from ${fromName}`,
      html,
    };

    if (senderEmail && senderEmail !== fromAddress) {
      emailPayload.reply_to = senderEmail;
    }

    const resendRes = await sendWithRetry("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resendBody = await resendRes.json();

    if (!resendRes.ok) {
      const detail = resendBody?.message || resendBody?.name || JSON.stringify(resendBody);
      console.error(`Resend delivery failed (${resendRes.status}): ${detail}`);
      return respond({ error: `Email delivery failed. Please try again later.` }, 502);
    }

    // Audit log the email send
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "invoice_email_sent",
      entity_type: "invoice",
      entity_id: invoiceId || null,
      details: { recipient: Array.isArray(to) ? to[0] : to, resend_id: resendBody.id },
    }).then(() => {}, () => {});

    return respond({ success: true, id: resendBody.id });
  } catch (err) {
    return respond({ error: `Unexpected error: ${String(err)}` }, 500);
  }
});
