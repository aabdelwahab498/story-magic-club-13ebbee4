// send-contact-email — best-effort notification on new contact submissions.
// Currently a no-op stub that just logs. Wire to Resend/email provider in Phase 8.
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { checkRateLimits, identifierFromRequest, rateLimitResponse } from "../_shared/rateLimit.ts";
import { moderateText, moderationRejectedResponse, ModerationGatewayError } from "../_shared/moderation.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Body size guard (~8KB)
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 8_192) {
    return new Response(JSON.stringify({ error: "payload_too_large" }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit per user/IP — strict on this anonymous-friendly endpoint
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

  try {
    const body = await req.json().catch(() => ({}));

    // Moderate name + subject + message before logging/forwarding
    const toModerate = [body?.name, body?.subject, body?.message]
      .filter((v) => typeof v === "string")
      .join("\n")
      .slice(0, 4000);
    if (toModerate.trim().length > 0) {
      try {
        const verdict = await moderateText(toModerate, { language: typeof body?.language === "string" ? body.language : undefined });
        if (!verdict.allowed || verdict.severity === "high" || verdict.severity === "critical") {
          console.warn("[send-contact-email] moderation rejected", { severity: verdict.severity, categories: verdict.categories });
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

    console.log("[send-contact-email] received:", JSON.stringify(body).slice(0, 500));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-contact-email] error:", e);
    return new Response(JSON.stringify({ error: "failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
