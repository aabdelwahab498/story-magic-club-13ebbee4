// generate-story-music — generates a calm background music track via ElevenLabs Music API.
// Caches by (theme, mood) to avoid regenerating expensive tracks. Stores MP3 in
// the public `story-music` bucket. Gated behind the paid `audio` feature; falls back
// to {fallback:true} for guests/free so the client can stay silent gracefully.
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

const ELEVEN_KEY = Deno.env.get("ELEVENLABS_API_KEY");

interface ReqBody {
  theme?: string;
  mood?: string;
  durationSeconds?: number;
}

function cacheKey(theme: string, mood: string, dur: number): string {
  return `${theme.toLowerCase().trim()}__${mood.toLowerCase().trim()}__${dur}`;
}

function buildPrompt(theme: string, mood: string): string {
  return [
    `Soft instrumental background music for a children's bedtime story.`,
    `Theme: ${theme}.`,
    `Mood: ${mood}.`,
    `Gentle piano, light strings and warm pads. Slow tempo (60-75 BPM).`,
    `Loopable, no sudden changes, no vocals, no percussion hits, very low intensity.`,
  ].join(" ");
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Body size guard (~4KB)
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 4_096) return json({ error: "payload_too_large" }, 413);

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody;
    const theme = (typeof body.theme === "string" ? body.theme : "friendship").slice(0, 80).trim() || "friendship";
    const mood = (typeof body.mood === "string" ? body.mood : "calm").slice(0, 40).trim() || "calm";
    const durRaw = Number(body.durationSeconds);
    const duration = Math.max(20, Math.min(120, Number.isFinite(durRaw) ? durRaw : 60));

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Subscription gate
    const { data: userData } = await sb.auth.getUser();
    const userId = userData?.user?.id ?? null;
    let allowed = false;
    if (userId) {
      const { data } = await admin.rpc("has_paid_feature", {
        _user_id: userId,
        _feature: "audio",
      });
      allowed = !!data;
    }
    if (!allowed) {
      return json({ error: "subscription_required", feature: "audio", fallback: true }, 200);
    }
    const rlMus = await checkRateLimits(`u:${userId}`, "generate-story-music", [
      { windowSec: 60, max: 2 },
      { windowSec: 3600, max: 10 },
      { windowSec: 86400, max: 30 },
    ]);
    if (!rlMus.allowed) return rateLimitResponse(rlMus, corsHeaders);

    // Cache lookup
    const key = cacheKey(theme, mood, duration);
    const { data: cached } = await admin
      .from("story_music_cache")
      .select("audio_url")
      .eq("cache_key", key)
      .maybeSingle();
    if (cached?.audio_url) {
      return json({ audioUrl: cached.audio_url, cached: true }, 200);
    }

    if (!ELEVEN_KEY) {
      return json({ error: "music_not_configured", fallback: true }, 200);
    }

    // Generate via ElevenLabs Music
    const elResp = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: buildPrompt(theme, mood),
        music_length_ms: duration * 1000,
      }),
    });
    if (!elResp.ok) {
      const t = await elResp.text().catch(() => "");
      console.error("[story-music] eleven failed", elResp.status, t.slice(0, 300));
      return json({ error: "music_generation_failed", fallback: true }, 200);
    }
    const audioBuffer = new Uint8Array(await elResp.arrayBuffer());

    // Upload to public bucket
    const path = `${theme}/${mood}/${duration}-${crypto.randomUUID()}.mp3`;
    const { error: upErr } = await admin.storage
      .from("story-music")
      .upload(path, audioBuffer, { contentType: "audio/mpeg", upsert: false });
    if (upErr) {
      console.error("[story-music] upload failed", upErr);
      return json({ error: "upload_failed", fallback: true }, 200);
    }
    const { data: pub } = admin.storage.from("story-music").getPublicUrl(path);
    const audioUrl = pub.publicUrl;

    // Cache row
    await admin.from("story_music_cache").insert({
      cache_key: key,
      theme,
      mood,
      audio_url: audioUrl,
      duration_seconds: duration,
    });

    return json({ audioUrl, cached: false }, 200);
  } catch (e) {
    console.error("generate-story-music error", e);
    return json({ error: e instanceof Error ? e.message : "unknown", fallback: true }, 200);
  }
});

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
