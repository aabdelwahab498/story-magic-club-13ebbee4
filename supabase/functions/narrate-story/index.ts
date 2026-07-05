// Narrate text using Google Cloud Text-to-Speech (the only TTS provider).
// Voice, pitch, and rate are derived per language / character / age band in
// the shared TTS module so this function stays focused on auth, quotas, and
// returning MP3 base64 to the client.
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";
import { synthesizeSpeech, TtsError } from "../_shared/tts.ts";

serve(async (req) => {
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

  try {
    const raw = await req.json().catch(() => ({}));
    const text = typeof raw.text === "string" ? raw.text.slice(0, 5000).trim() : "";
    const language = typeof raw.language === "string" ? raw.language.slice(0, 5).toLowerCase() : "en";
    const character = typeof raw.character === "string" ? raw.character.slice(0, 40) : "";
    const ageId = typeof raw.ageId === "string" ? raw.ageId.slice(0, 10) : "";
    const ALLOWED_LANGS = new Set(["en", "ar", "de", "fr", "it", "es"]);
    if (!text) {
      return new Response(JSON.stringify({ error: "text_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_LANGS.has(language)) {
      return new Response(JSON.stringify({ error: "invalid_language" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY")) {
      return new Response(JSON.stringify({ error: "tts_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rlNar = await checkRateLimits(`u:${userId}`, "narrate-story", [
      { windowSec: 60, max: 5 },
      { windowSec: 3600, max: 30 },
      { windowSec: 86400, max: 120 },
    ]);
    if (!rlNar.allowed) return rateLimitResponse(rlNar, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: paidAllowed } = await admin.rpc("has_paid_feature", {
      _user_id: userId, _feature: "audio",
    });
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    const allowed = !!paidAllowed || !!isAdmin;
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "subscription_required", feature: "audio" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Trim very long text to keep cost/latency reasonable
    const trimmed = text.length > 4500 ? text.slice(0, 4500) : text;

    console.log("narrate-story: synthesizing", { language, character, ageId, chars: trimmed.length });
    const buf = await synthesizeSpeech({
      text: trimmed,
      language,
      character: character || undefined,
      ageId: ageId || undefined,
    });

    return new Response(
      JSON.stringify({
        audioContent: base64Encode(buf),
        voiceUsed: `google-cloud-tts:${language}:${character || "default"}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("narrate-story error:", e);
    const status = e instanceof TtsError ? e.status : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
