// export-story-audio — Production MP3 export inside the app (no external workflows).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { synthesizeSpeech } from "../_shared/tts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "story-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const MAX_TEXT_CHARS = 20_000;
const CHUNK_MAX_WORDS = 260;
const PROVIDER = "openai";

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function friendly(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ success: false, error: code, ...extra }, status);
}

async function contentHash(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function slug(input: string, fallback = "story") {
  const cleaned = (input || "")
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return cleaned || fallback;
}

function wordCount(text: string) {
  return (text.match(/\S+/g) ?? []).length;
}

function chunkForTts(text: string, maxWords = CHUNK_MAX_WORDS): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const sentences = normalized.match(/[^.!?؟。！？]+[.!?؟。！？]*\s*/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (wordCount(sentence) > maxWords) {
      flush();
      const words = sentence.match(/\S+/g) ?? [];
      for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(" "));
      continue;
    }
    if (current && wordCount(current) + wordCount(sentence) > maxWords) flush();
    current += sentence;
  }
  flush();
  return chunks.filter((c) => c.length > 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return friendly("method_not_allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return friendly("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return friendly("unauthorized", 401);
  const userId = userData.user.id;

  let payload: ExportAudioRequest;
  try { payload = (await req.json()) as ExportAudioRequest; }
  catch { return friendly("invalid_json", 400); }

  if (!payload?.full_text?.trim()) return friendly("full_text_required", 400);
  if (payload.full_text.length > MAX_TEXT_CHARS) return friendly("text_too_long", 400, { max_chars: MAX_TEXT_CHARS });
  if (!Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY")) return friendly("tts_not_configured", 500);

  const language = (payload.language || "en").toLowerCase().slice(0, 5);
  const speed = payload.speed && payload.speed >= 0.5 && payload.speed <= 1.5 ? payload.speed : 1.0;
  const voiceId = payload.voice_id || `${language}-default`;
  const chunks = chunkForTts(payload.full_text);
  if (chunks.length === 0) return friendly("full_text_required", 400);

  const rl = await checkRateLimit(`u:${userId}`, "export-story-audio", { windowSec: 3600, max: 5, blockSec: 600 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const hash = await contentHash(`${payload.full_text}|${voiceId}|${speed}|${language}|v2`);
  const filename = `${slug(payload.title ?? "story")}.mp3`;
  const objectPath = `${userId}/${hash}.mp3`;

  const { data: exportRow, error: insertErr } = await admin.from("exports").insert({
    user_id: userId,
    story_id: payload.story_id ?? null,
    child_id: payload.child_id ?? null,
    type: "mp3",
    language,
    status: "generating",
    metadata: { title: payload.title, child_name: payload.child_name, emotion_tags: payload.emotion_tags ?? [] },
    audio_metadata: { voice_id: voiceId, speed, content_hash: hash, chunk_count: chunks.length },
  }).select("id").single();
  if (insertErr || !exportRow) {
    console.error("[export-story-audio] db insert failed", insertErr);
    return friendly("db_insert_failed", 500);
  }
  const exportId = exportRow.id as string;

  const finalize = async (opts: { signedUrl: string; size: number; provider: string; cacheHit: boolean }) => {
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    await admin.from("exports").update({
      status: "ready",
      file_path: objectPath,
      signed_url: opts.signedUrl,
      file_size: opts.size,
      provider: opts.provider,
      expires_at: expiresAt,
      audio_metadata: { voice_id: voiceId, speed, content_hash: hash, cache_hit: opts.cacheHit, chunk_count: chunks.length },
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId,
      user_id: userId,
      action: "generated",
      details: { provider: opts.provider, cache_hit: opts.cacheHit, bytes: opts.size, chunk_count: chunks.length },
    });
    return json({
      success: true,
      export_id: exportId,
      download_url: opts.signedUrl,
      file_name: filename,
      file_size: opts.size,
      duration_seconds: null,
      provider: opts.provider,
      expires_at: expiresAt,
      cache_hit: opts.cacheHit,
    });
  };

  const { data: cached, error: cacheReadErr } = await admin.from("audio_cache")
    .select("id, file_path, provider, file_size, used_count")
    .eq("content_hash", hash)
    .maybeSingle();
  if (cacheReadErr) console.warn("[export-story-audio] cache read skipped", cacheReadErr);

  if (cached?.file_path) {
    const signed = await admin.storage.from(BUCKET).createSignedUrl(cached.file_path, SIGNED_URL_TTL_SECONDS, { download: filename });
    if (signed.data?.signedUrl) {
      await admin.from("audio_cache").update({
        used_count: (cached.used_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      }).eq("id", cached.id);
      return finalize({ signedUrl: signed.data.signedUrl, size: cached.file_size ?? 0, provider: cached.provider ?? PROVIDER, cacheHit: true });
    }
  }

  try {
    const pieces: Uint8Array[] = [];
    let totalBytes = 0;
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[export-story-audio] synthesizing chunk ${i + 1}/${chunks.length}`);
      const audio = await synthesizeSpeech({ text: chunks[i], language });
      pieces.push(audio);
      totalBytes += audio.byteLength;
    }

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const piece of pieces) {
      merged.set(piece, offset);
      offset += piece.byteLength;
    }

    const upload = await admin.storage.from(BUCKET).upload(objectPath, merged, {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (upload.error) {
      await admin.from("exports").update({ status: "failed", error_message: upload.error.message }).eq("id", exportId);
      return friendly("storage_upload_failed", 500);
    }

    const cacheUpsert = await admin.from("audio_cache").upsert({
      content_hash: hash,
      file_path: objectPath,
      provider: PROVIDER,
      voice_id: voiceId,
      language,
      file_size: merged.byteLength,
      used_count: 1,
      last_used_at: new Date().toISOString(),
    }, { onConflict: "content_hash" });
    if (cacheUpsert.error) console.warn("[export-story-audio] cache write skipped", cacheUpsert.error);

    const signed = await admin.storage.from(BUCKET).createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
    if (!signed.data?.signedUrl) return friendly("sign_url_failed", 500);
    return finalize({ signedUrl: signed.data.signedUrl, size: merged.byteLength, provider: PROVIDER, cacheHit: false });
  } catch (err) {
    console.error("[export-story-audio] tts failed", err);
    await admin.from("exports").update({
      status: "failed",
      error_message: (err as Error).message.slice(0, 500),
    }).eq("id", exportId);
    return friendly("tts_pipeline_failed", 502, { message: (err as Error).message });
  }
});