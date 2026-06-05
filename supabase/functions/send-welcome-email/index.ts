// Sends a branded "Welcome to NajmaH" email after signup.
// Uses Brevo (if BREVO_API_KEY is configured via the Lovable connector gateway).
// Falls back to logging silently so signup is never blocked.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP_URL = Deno.env.get("APP_URL") ?? "https://najmah.app";
const FROM_EMAIL = Deno.env.get("WELCOME_FROM_EMAIL") ?? "no-reply@najmah.app";
const FROM_NAME = "NajmaH";
const SUPPORT_EMAIL = "support@najmah.com";

interface Body {
  email: string;
  name?: string;
  language?: string;
}

function template(name: string, lang: string) {
  const isAr = lang?.startsWith("ar");
  const greeting = isAr ? `أهلاً ${name || "صديقنا"} 👋` : `Hi ${name || "there"} 👋`;
  const subject = isAr ? "أهلاً بك في NajmaH" : "Welcome to NajmaH";
  const intro = isAr
    ? "يسعدنا انضمامك إلى عائلة نجمة! منصتنا تساعد الأطفال على عيش قصص تفاعلية ممتعة وتعليمية يصنعها الذكاء الاصطناعي."
    : "We're delighted to welcome you to NajmaH — an interactive AI-powered storytelling platform that helps children enjoy magical, educational stories tailored just for them.";
  const cta = isAr ? "افتح حسابي" : "Open my account";
  const supportLine = isAr
    ? `أي سؤال؟ راسلنا في أي وقت على <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`
    : `Questions? Reach us anytime at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;

  const html = `<!doctype html>
<html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f6f5ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f5ff;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(99,102,241,0.12);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:32px 28px;text-align:center;color:#ffffff;">
          <div style="font-size:36px;line-height:1;">✨</div>
          <h1 style="margin:8px 0 4px;font-size:24px;font-weight:800;">NajmaH</h1>
          <p style="margin:0;font-size:14px;opacity:0.9;">${isAr ? "قصص تفاعلية للأطفال" : "Interactive stories for kids"}</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <h2 style="margin:0 0 12px;font-size:20px;">${greeting}</h2>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${intro}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px auto;">
            <tr><td style="border-radius:999px;background:#6366f1;">
              <a href="${APP_URL}/auth" style="display:inline-block;padding:14px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:999px;">${cta}</a>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:13px;color:#64748b;line-height:1.6;text-align:center;">${supportLine}</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 28px;text-align:center;font-size:11px;color:#94a3b8;">
          © ${new Date().getFullYear()} NajmaH · <a href="${APP_URL}" style="color:#94a3b8;">${APP_URL.replace(/^https?:\/\//, "")}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html };
}

async function sendViaBrevo(to: string, name: string, subject: string, html: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const BREVO_KEY = Deno.env.get("BREVO_API_KEY");
  if (!LOVABLE_API_KEY || !BREVO_KEY) {
    return { ok: false, reason: "brevo_not_configured" as const };
  }
  const res = await fetch("https://connector-gateway.lovable.dev/brevo/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": BREVO_KEY,
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: FROM_EMAIL },
      to: [{ email: to, name: name || undefined }],
      subject,
      htmlContent: html,
      replyTo: { email: SUPPORT_EMAIL, name: "NajmaH Support" },
    }),
  });
  const body = await res.text();
  return res.ok
    ? { ok: true as const, messageId: tryJson(body)?.messageId ?? null }
    : { ok: false as const, reason: `brevo_${res.status}`, body };
}

function tryJson(s: string) { try { return JSON.parse(s); } catch { return null; } }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Auth: must be called either from the app with a valid user JWT (matching email)
  // or from server code carrying the service-role bearer.
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const isService = bearer && serviceKey && bearer === serviceKey;

  let callerEmail: string | null = null;
  if (!isService) {
    if (!bearer) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        serviceKey,
      );
      const { data: userData, error: userErr } = await adminClient.auth.getUser(bearer);
      if (userErr || !userData?.user?.email) {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerEmail = userData.user.email.toLowerCase();
    } catch {
      return new Response(JSON.stringify({ error: "auth_failed" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!body.email || typeof body.email !== "string") {
    return new Response(JSON.stringify({ error: "email_required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Non-service callers can only send to their own email (prevents spam)
  if (!isService && callerEmail && body.email.toLowerCase() !== callerEmail) {
    return new Response(JSON.stringify({ error: "email_mismatch" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const lang = body.language ?? "en";
  const name = (body.name ?? "").split(" ")[0] || "";
  const { subject, html } = template(name, lang);

  let status: "sent" | "failed" | "skipped" = "skipped";
  let error: string | null = null;
  try {
    const r = await sendViaBrevo(body.email, name, subject, html);
    if (r.ok) status = "sent";
    else { status = "failed"; error = r.reason; }
  } catch (e) {
    status = "failed";
    error = (e as Error).message;
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await supabase.from("email_delivery_log").insert({
      template: "welcome",
      recipient: body.email,
      status,
      error,
      payload: { name, language: lang },
    });
  } catch (logErr) {
    console.warn("welcome email log failed:", logErr);
  }

  return new Response(JSON.stringify({ ok: status !== "failed", status, error }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
