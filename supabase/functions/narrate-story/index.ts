// Narrate text using ElevenLabs multilingual TTS (eleven_multilingual_v2)
// Voice is selected per character so each storyteller sounds in-character.
// Includes a robust fallback chain so narration never fails silently.
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

// Default per-language voices (used as fallback when no character is provided
// or when the character voice fails for the requested language).
const VOICE_BY_LANG: Record<string, string> = {
  en: "EXAVITQu4vr4xnSDxMaL", // Sarah
  ar: "XrExE9yKIg1WjnnlVkGX", // Matilda
  de: "FGY2WhTYpPnrIDTdsKH5", // Laura
  fr: "Xb7hH8MSUJpSbSDYk0k2", // Alice
  it: "cgSgspJ2msm6clMCkdW9", // Jessica
  es: "pFZP5JQG7iQjIQuC4Bku", // Lily
};

// Final safety net voice — always available on ElevenLabs free tier.
const ULTIMATE_FALLBACK_VOICE = "EXAVITQu4vr4xnSDxMaL"; // Sarah

type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
};

const DEFAULT_SETTINGS: VoiceSettings = {
  stability: 0.55,
  similarity_boost: 0.75,
  style: 0.4,
  use_speaker_boost: true,
};

// Character-driven voices with tuned voice_settings to match the persona.
// Some character voices may not support every language — we always fall back
// to the per-language voice if the character voice request fails.
const CHARACTER_VOICES: Record<
  string,
  { voiceId: string; settings: VoiceSettings; description: string }
> = {
  wizard: {
    voiceId: "JBFqnCBsd6RMkjVDRZzb", // George — deep adult male
    settings: { stability: 0.7, similarity_boost: 0.8, style: 0.5, use_speaker_boost: true },
    description: "Wise wizard — deep, warm, mystical man",
  },
  fairy: {
    voiceId: "pFZP5JQG7iQjIQuC4Bku", // Lily — friendly female
    settings: { stability: 0.5, similarity_boost: 0.85, style: 0.7, use_speaker_boost: true },
    description: "Friendly fairy — light, sweet, sparkling woman",
  },
  robot: {
    voiceId: "kPtEHAvRnjUJFv7SK9WI", // Glitch — robotic / glitchy
    settings: { stability: 0.95, similarity_boost: 0.4, style: 0.0, use_speaker_boost: false },
    description: "Robot — flat, mechanical, synthetic",
  },
  dragon: {
    voiceId: "TX3LPaxmHKxFdv7VOQHJ", // Liam — young energetic male
    settings: { stability: 0.35, similarity_boost: 0.75, style: 0.85, use_speaker_boost: true },
    description: "Dragon — energetic young child, full of spark",
  },
  alien: {
    voiceId: "IKne3meq5aSn9XLyUdCD", // Charlie — quirky, otherworldly
    settings: { stability: 0.25, similarity_boost: 0.5, style: 0.95, use_speaker_boost: true },
    description: "Alien — quirky, otherworldly, strange",
  },
};

async function tryTts(
  voiceId: string,
  text: string,
  settings: VoiceSettings,
  apiKey: string,
): Promise<{ ok: true; buf: ArrayBuffer } | { ok: false; status: number; error: string }> {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: settings,
    }),
  });
  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => "");
    return { ok: false, status: resp.status, error: errTxt };
  }
  return { ok: true, buf: await resp.arrayBuffer() };
}

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
    const ALLOWED_LANGS = new Set(["en","ar","de","fr","it","es"]);
    if (!text) {
      return new Response(JSON.stringify({ error: "text_required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_LANGS.has(language)) {
      return new Response(JSON.stringify({ error: "invalid_language" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "tts_not_configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side subscription gate. If the user isn't allowed (or not signed in)
    // we return 200 + fallback:true so the client transparently switches to Browser TTS.
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
        JSON.stringify({ error: "unauthorized", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
    const { data: paidAllowed, error: paidErr } = await admin.rpc("has_paid_feature", {
      _user_id: userId,
      _feature: "audio",
    });
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (paidErr) console.error("narrate-story paid gate failed", paidErr);
    if (roleErr) console.error("narrate-story admin gate failed", roleErr);
    const allowed = !!paidAllowed || !!isAdmin;
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "subscription_required", feature: "audio", fallback: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lang = language;
    const charKey = character.toLowerCase();
    const charVoice = CHARACTER_VOICES[charKey];
    const langVoice = VOICE_BY_LANG[lang] || VOICE_BY_LANG.en;

    // Build ordered, deduped fallback chain:
    //   1) character voice (if provided)
    //   2) per-language default voice
    //   3) English default voice
    //   4) ultimate hardcoded safety voice
    const chain: Array<{ voiceId: string; settings: VoiceSettings; label: string }> = [];
    const seen = new Set<string>();
    const push = (voiceId: string | undefined, settings: VoiceSettings, label: string) => {
      if (!voiceId || seen.has(voiceId)) return;
      seen.add(voiceId);
      chain.push({ voiceId, settings, label });
    };
    if (charVoice) push(charVoice.voiceId, charVoice.settings, `character:${charKey}`);
    push(langVoice, DEFAULT_SETTINGS, `lang:${lang}`);
    push(VOICE_BY_LANG.en, DEFAULT_SETTINGS, "lang:en");
    push(ULTIMATE_FALLBACK_VOICE, DEFAULT_SETTINGS, "ultimate");

    // Trim very long text to keep cost/latency reasonable
    const trimmed = text.length > 4500 ? text.slice(0, 4500) : text;

    let lastError = "unknown";
    let lastStatus = 0;

    for (const step of chain) {
      console.log("narrate-story attempt:", { step: step.label, voiceId: step.voiceId, lang });
      const result = await tryTts(step.voiceId, trimmed, step.settings, apiKey);
      if (result.ok) {
        const audioBase64 = base64Encode(new Uint8Array(result.buf));
        return new Response(
          JSON.stringify({
            audioContent: audioBase64,
            voiceUsed: step.label,
            fallback: step.label !== chain[0].label,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      lastError = result.error;
      lastStatus = result.status;
      console.warn("narrate-story step failed:", {
        step: step.label,
        status: result.status,
        error: result.error?.slice(0, 200),
      });
      // Auth / quota / payment errors won't get better with a different voice
      if ([401, 403, 402].includes(result.status)) break;
    }

    console.error("narrate-story: all voice fallbacks failed", { lastStatus, lastError });
    // Return 200 with `fallback: true` so the Supabase client SDK can read the
    // body (it throws on non-2xx, discarding the response). The client uses
    // this signal to switch to the browser's built-in Web Speech API.
    return new Response(
      JSON.stringify({
        error: "tts_failed",
        fallback: true,
        status: lastStatus,
        detail: lastError?.slice(0, 300),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("narrate-story error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
