// n8n-export-audio — Fully in-app audio export using Google Cloud TTS.
// No external workflows. Cache-first via SHA-256; on miss it synthesizes MP3
// with the shared TTS module, uploads to `story-audio`, and returns a signed URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { synthesizeSpeech } from "../_shared/tts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "story-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const MAX_TEXT_CHARS = 10_000;

interface ExportAudioRequest {
  story_id?: string | null;
  child_id?: string | null;
  title?: string;
  full_text: string;
  language: string;
  voice_id?: string;
  emotion_tags?: string[];
  child_name?: string | null;
  speed?: number;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function friendly(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ success: false, error: code, ...extra }, status);
}
async function contentHash(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function slug(s: string, fb = "story") {
  const c = (s || "").replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60);
  return c || fb;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return friendly("method_not_allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return friendly("unauthorized", 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: uData, error: uErr } = await userClient.auth.getUser();
  if (uErr || !uData?.user) return friendly("unauthorized", 401);
  const userId = uData.user.id;

  let payload: ExportAudioRequest;
  try { payload = (await req.json()) as ExportAudioRequest; }
  catch { return friendly("invalid_json", 400); }
  if (!payload?.full_text?.trim()) return friendly("full_text_required", 400);
  if (payload.full_text.length > MAX_TEXT_CHARS) return friendly("text_too_long", 400, { max_chars: MAX_TEXT_CHARS });
  if (!Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY")) return friendly("tts_not_configured", 500);

  const language = (payload.language || "en").toLowerCase().slice(0, 5);
  const speed = payload.speed && payload.speed >= 0.5 && payload.speed <= 1.5 ? payload.speed : 1.0;
  const voiceId = payload.voice_id || `${language}-default`;

  const rl = await checkRateLimit(`u:${userId}`, "export-audio", { windowSec: 3600, max: 5, blockSec: 600 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const hash = await contentHash(`${payload.full_text}|${voiceId}|${speed}|${language}`);
  const filename = `${slug(payload.title ?? "story")}.mp3`;
  const objectPath = `${userId}/${hash}.mp3`;

  const { data: exportRow, error: insertErr } = await admin.from("exports").insert({
    user_id: userId, story_id: payload.story_id ?? null, child_id: payload.child_id ?? null,
    type: "mp3", language, status: "generating",
    metadata: { title: payload.title, child_name: payload.child_name, emotion_tags: payload.emotion_tags },
    audio_metadata: { voice_id: voiceId, speed, content_hash: hash },
  }).select("id").single();
  if (insertErr || !exportRow) return friendly("db_insert_failed", 500);
  const exportId = exportRow.id as string;

  const finalize = async (opts: { signedUrl: string; size: number; provider: string; cacheHit: boolean; }) => {
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    await admin.from("exports").update({
      status: "ready", file_path: objectPath, signed_url: opts.signedUrl,
      file_size: opts.size, provider: opts.provider, expires_at: expiresAt,
      audio_metadata: { voice_id: voiceId, speed, content_hash: hash, cache_hit: opts.cacheHit },
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "generated",
      details: { provider: opts.provider, cache_hit: opts.cacheHit, bytes: opts.size },
    });
    return json({
      success: true, export_id: exportId, download_url: opts.signedUrl,
      file_name: filename, file_size: opts.size, duration_seconds: null,
      provider: opts.provider, expires_at: expiresAt, cache_hit: opts.cacheHit,
    });
  };

  // Cache lookup
  const { data: cached } = await admin.from("audio_cache")
    .select("id, file_path, provider, file_size, used_count")
    .eq("content_hash", hash).maybeSingle();
  if (cached?.file_path) {
    const signed = await admin.storage.from(BUCKET).createSignedUrl(cached.file_path, SIGNED_URL_TTL_SECONDS, { download: filename });
    if (signed.data?.signedUrl) {
      await admin.from("audio_cache").update({
        used_count: (cached.used_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      }).eq("id", cached.id);
      return finalize({ signedUrl: signed.data.signedUrl, size: cached.file_size ?? 0, provider: cached.provider ?? "cache", cacheHit: true });
    }
  }

  // Synthesize with local TTS
  try {
    const audio = await synthesizeSpeech({ text: payload.full_text, language });
    const up = await admin.storage.from(BUCKET).upload(objectPath, audio, {
      contentType: "audio/mpeg", upsert: true,
    });
    if (up.error) {
      await admin.from("exports").update({ status: "failed", error_message: up.error.message }).eq("id", exportId);
      return friendly("storage_upload_failed", 500);
    }
    await admin.from("audio_cache").upsert({
      content_hash: hash, file_path: objectPath, provider: "google-tts",
      voice_id: voiceId, language, file_size: audio.byteLength,
      used_count: 1, last_used_at: new Date().toISOString(),
    }, { onConflict: "content_hash" });
    const signed = await admin.storage.from(BUCKET).createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
    if (!signed.data?.signedUrl) return friendly("sign_url_failed", 500);
    return finalize({ signedUrl: signed.data.signedUrl, size: audio.byteLength, provider: "google-tts", cacheHit: false });
  } catch (err) {
    console.error("[n8n-export-audio] tts failed", err);
    await admin.from("exports").update({
      status: "failed", error_message: (err as Error).message.slice(0, 500),
    }).eq("id", exportId);
    return friendly("tts_pipeline_failed", 502, { message: (err as Error).message });
  }
});
