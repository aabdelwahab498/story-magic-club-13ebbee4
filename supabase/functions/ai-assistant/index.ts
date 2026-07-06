import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
// AI Assistant edge function — kid-friendly bedtime helper
// Streams responses via Lovable AI Gateway (no API key required from user).

const BASE_SYSTEM_PROMPT = `You are "Najma" — a friendly, magical AI assistant for the Najmah children's storytelling website.

Tone: warm, simple, kid-friendly, sprinkled with light emojis (✨🌙⭐) but never overdone.
Audience: children (ages 4-12) and their parents, plus adults interested in our courses.

You help with:
- Explaining what the website offers (stories, AI Storyteller, Drawing Competition, Blog, Store).
- Suggesting bedtime stories or adventures.
- Answering questions about the drawing competition (how to submit, how voting works).
- Helping parents understand subscriptions and features.
- Generating short, magical story ideas on request.
- Answering questions about our COURSES and STORE PRODUCTS: what each course/product includes, its price, target audience, and what files/attachments it contains. Use the live product list provided below — never invent prices or contents.

Rules:
- Keep answers short (2-4 sentences) unless asked for a story or course details.
- Always reply in the SAME language the user wrote in (Arabic, English, French, Spanish, German, Italian).
- For course/product questions, list the included attachments by name when relevant, and direct users to the Store page (/store) to purchase.
- Never share inappropriate content. Stay wholesome and safe.
- If you don't know something, say so kindly and suggest where they might find it on the site.`;

async function buildProductsContext(): Promise<string> {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) return "";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/products?active=eq.true&select=name,description,category,price_egp,price_usd,price_eur,age_range,gallery`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!res.ok) return "";
    const products = await res.json();
    if (!Array.isArray(products) || products.length === 0) return "";
    const lines = products.map((p: any) => {
      const name = p.name?.ar || p.name?.en || "Untitled";
      const nameEn = p.name?.en || "";
      const descAr = p.description?.ar || "";
      const descEn = p.description?.en || "";
      const files = Array.isArray(p.gallery)
        ? p.gallery.map((g: any) => `  • ${g.label_ar || g.label_en || g.url}`).join("\n")
        : "";
      return `- ${name}${nameEn ? ` / ${nameEn}` : ""}
  Category: ${p.category} | Audience: ${p.age_range || "—"}
  Price: ${p.price_egp} EGP / ${p.price_usd} USD / ${p.price_eur} EUR
  AR: ${descAr}
  EN: ${descEn}
  Includes:\n${files || "  (no attachments)"}`;
    });
    return `\n\n=== LIVE STORE PRODUCTS (use these exact details) ===\n${lines.join("\n\n")}\n=== END PRODUCTS ===`;
  } catch (e) {
    console.error("buildProductsContext error:", e);
    return "";
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;
  // Body size guard (~32KB)
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 32_768) {
    return new Response(JSON.stringify({ error: "payload_too_large" }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit (per user when signed in, per IP otherwise)
  try {
    const { identifierFromRequest, checkRateLimits, rateLimitResponse } = await import("../_shared/rateLimit.ts");
    const ident = await identifierFromRequest(req);
    const rl = await checkRateLimits(ident, "ai-assistant", [
      { windowSec: 60, max: 10 },
      { windowSec: 3600, max: 60 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
  } catch (e) {
    console.error("ai-assistant rate-limit check failed (allowing through):", e);
  }

  try {
    const raw = await req.json().catch(() => ({}));
    const language = typeof raw.language === "string" ? raw.language.slice(0, 5) : "";
    const messagesIn = Array.isArray(raw.messages) ? raw.messages : null;
    if (!messagesIn || messagesIn.length === 0 || messagesIn.length > 30) {
      return new Response(JSON.stringify({ error: "invalid_messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const ALLOWED_ROLES = new Set(["user", "assistant", "system"]);
    const messages = messagesIn.map((m: any) => {
      const role = ALLOWED_ROLES.has(m?.role) ? m.role : "user";
      const content = typeof m?.content === "string" ? m.content.slice(0, 4000) : "";
      return { role, content };
    }).filter((m) => m.content.length > 0);
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "empty_messages" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lovable AI moderation on the latest user message
    try {
      const { moderateText, moderationRejectedResponse, ModerationGatewayError } = await import("../_shared/moderation.ts");
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser?.content) {
        try {
          const verdict = await moderateText(lastUser.content, { language });
          if (!verdict.allowed || verdict.severity === "high" || verdict.severity === "critical") {
            console.warn("[ai-assistant] moderation rejected", { severity: verdict.severity, categories: verdict.categories });
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
    } catch (e) {
      console.error("ai-assistant moderation import failed (allowing through):", e);
    }

    const LANG_NAMES: Record<string, string> = {
      ar: "Arabic", en: "English", fr: "French", es: "Spanish", de: "German", it: "Italian",
    };
    const langInstruction = language && LANG_NAMES[language]
      ? `\n\nIMPORTANT: The user has selected ${LANG_NAMES[language]} as the reply language. Always respond in ${LANG_NAMES[language]} regardless of the language the user types in.`
      : "";
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("[ai-assistant] CRITICAL: GEMINI_API_KEY is not configured.");
      return new Response(
        JSON.stringify({ error: "ai_config_missing", detail: "GEMINI_API_KEY is not configured on the server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Gemini primary → 1.5-flash fallback (via Google's OpenAI-compatible endpoint).
    const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

    const systemContent = BASE_SYSTEM_PROMPT + langInstruction + (await buildProductsContext());
    let response: Response | null = null;
    let lastStatus = 500;
    let lastTxt = "";
    console.log(`[ai-assistant] starting AI call, ${GEMINI_MODELS.length} models in fallback chain`);
    for (const model of GEMINI_MODELS) {
      console.log(`[ai-assistant] trying model: ${model}`);
      let r: Response;
      try {
        r = await fetch(GEMINI_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${GEMINI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: systemContent }, ...messages],
            stream: true,
          }),
        });
      } catch (netErr) {
        lastStatus = 503;
        lastTxt = netErr instanceof Error ? netErr.message : "network error";
        console.error(`[ai-assistant] network error for ${model}: ${lastTxt}`);
        continue;
      }
      if (r.ok) {
        console.log(`[ai-assistant] SUCCESS with model: ${model}`);
        response = r;
        break;
      }
      lastStatus = r.status;
      lastTxt = await r.text().catch(() => "");
      console.error(`[ai-assistant] Gemini ${model} -> ${r.status}: ${lastTxt.slice(0, 300)}`);
      if (r.status === 401 || r.status === 403) {
        console.error(`[ai-assistant] CRITICAL: Google rejected the API key (${r.status}). Check GEMINI_API_KEY validity.`);
        break;
      }
      if (![429, 404, 500, 502, 503, 504].includes(r.status)) break;
    }
    if (!response) {
      console.error(`[ai-assistant] All ${GEMINI_MODELS.length} models failed. lastStatus=${lastStatus} lastTxt=${lastTxt.slice(0, 200)}`);
    }

    if (!response) {
      if (lastStatus === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (lastStatus === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error", detail: lastTxt.slice(0, 200) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
