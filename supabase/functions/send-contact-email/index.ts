// Forwards a contact-form submission to support@najmah.com via Brevo
// (if BREVO_API_KEY connector is linked) and logs the result.
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { checkRateLimits, identifierFromRequest, rateLimitResponse } from "../_shared/rateLimit.ts";
import { moderateText, moderationRejectedResponse, ModerationGatewayError } from "../_shared/moderation.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPPORT_EMAIL = "support@najmah.com";
const FROM_EMAIL = Deno.env.get("CONTACT_FROM_EMAIL") ?? "no-reply@najmah.app";
const FROM_NAME = "NajmaH Contact Form";

interface ContactBody {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  language?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

async function forwardToSupport(body: ContactBody): Promise<{ ok: boolean; reason?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const BREVO_KEY = Deno.env.get("BREVO_API_KEY");
  if (!LOVABLE_API_KEY || !BREVO_KEY) return { ok: false, reason: "brevo_not_configured" };

  const subject = `[NajmaH Contact] ${body.subject?.slice(0, 120) ?? "(no subject)"}`;
  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;max-width:560px;">
  <h2 style="margin:0 0 12px;">New contact form message</h2>
  <table cellspacing="0" cellpadding="6" border="0" style="font-size:14px;">
    <tr><td><b>Name</b></td><td>${escapeHtml(body.name ?? "")}</td></tr>
    <tr><td><b>Email</b></td><td><a href="mailto:${escapeHtml(body.email ?? "")}">${escapeHtml(body.email ?? "")}</a></td></tr>
    <tr><td><b>Subject</b></td><td>${escapeHtml(body.subject ?? "")}</td></tr>
    <tr><td><b>Language</b></td><td>${escapeHtml(body.language ?? "en")}</td></tr>
  </table>
  <h3 style="margin:18px 0 6px;">Message</h3>
  <pre style="white-space:pre-wrap;background:#f8fafc;border-radius:8px;padding:12px;font-family:inherit;font-size:14px;">${escapeHtml(body.message ?? "")}</pre>
</div>`;

  const res = await fetch("https://connector-gateway.lovable.dev/brevo/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": BREVO_KEY,
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: SUPPORT_EMAIL, name: "NajmaH Support" }],
      replyTo: body.email ? { email: body.email, name: body.name || undefined } : undefined,
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { ok: false, reason: `brevo_${res.status}_${txt.slice(0, 200)}` };
  }
  await res.text();
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 8_192) {
    return new Response(JSON.stringify({ error: "payload_too_large" }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const ident = await identifierFromRequest(req);
    const rl = await checkRateLimits(ident, "send-contact-email", [
      { windowSec: 600, max: 2 },
      { windowSec: 3600, max: 5 },
      { windowSec: 86400, max: 10 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
  } catch (e) {
    console.error("send-contact-email rate-limit failed:", e);
  }

  let body: ContactBody = {};
  try { body = await req.json(); } catch { body = {}; }

  // Moderate name + subject + message
  const toModerate = [body?.name, body?.subject, body?.message]
    .filter((v) => typeof v === "string").join("\n").slice(0, 4000);
  if (toModerate.trim().length > 0) {
    try {
      const verdict = await moderateText(toModerate, {
        language: typeof body?.language === "string" ? body.language : undefined,
      });
      if (!verdict.allowed || verdict.severity === "high" || verdict.severity === "critical") {
        return moderationRejectedResponse(verdict, corsHeaders);
      }
    } catch (e) {
      if (e instanceof ModerationGatewayError) {
        return new Response(JSON.stringify({ error: "moderation_unavailable" }), {
          status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  // Forward to support email (best-effort)
  let status: "sent" | "failed" | "skipped" = "skipped";
  let error: string | null = null;
  try {
    const r = await forwardToSupport(body);
    if (r.ok) status = "sent";
    else { status = "failed"; error = r.reason ?? "unknown"; }
  } catch (e) {
    status = "failed";
    error = (e as Error).message;
  }

  // Log delivery attempt
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("email_delivery_log").insert({
      template: "contact_forward",
      recipient: SUPPORT_EMAIL,
      status,
      error,
      payload: {
        from_email: body.email,
        from_name: body.name,
        subject: body.subject,
        language: body.language,
      },
    });
  } catch (logErr) {
    console.warn("contact email log failed:", logErr);
  }

  return new Response(JSON.stringify({ ok: status !== "failed", status, error }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
