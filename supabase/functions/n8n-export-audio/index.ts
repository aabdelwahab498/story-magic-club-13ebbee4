// ============================================================================
// n8n-export-audio  —  Cached, cache-first TTS proxy to the n8n audio workflow
// ----------------------------------------------------------------------------
// Flow:
//   1. Auth + rate-limit (5/hour/user)
//   2. Compute SHA-256 content_hash of (text | voice_id | speed | language)
//   3. Check `audio_cache` table  → hit ⇒ bump usage + return signed URL
//   4. Miss ⇒ POST to n8n `/export-audio` webhook (60s timeout)
//   5. If n8n unavailable/fails ⇒ fall back to the in-house TTS service
//      (`_shared/tts/service.generateSpeech`) which already handles chunking,
//      Edge-TTS → OpenAI fallback, MP3 concat and Storage upload.
//   6. Upsert audio_cache + insert exports + export_logs rows
//   7. Return { download_url (signed), file_name, provider, duration }
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { generateSpeech } from "../_shared/tts/service.ts";
import { getN8nConfig } from "../_shared/n8nConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "story-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h
const N8N_TIMEOUT_MS = 60_000;
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
  speed?: number; // 0.8 | 1.0 | 1.2
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function friendly(code: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ success: false, error: code, ...extra }, status);
}

/** SHA-256 of text+voice+speed+language — matches n8n's Code node exactly. */
async function contentHash(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Filename slug (kept Arabic-safe). */
function slug(s: string, fallback = "story"): string {
  const cleaned = (s || "").replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60);
  return cleaned || fallback;
}

/** Call n8n audio webhook, expect { audio_base64, duration_seconds?, provider? }. */
async function callN8n(payload: ExportAudioRequest, admin: SupabaseClient): Promise<
  | { audio: Uint8Array; duration: number | null; provider: string }
  | null
> {
  const cfg = await getN8nConfig(admin, "mp3");
  if (!cfg.url) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), N8N_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": cfg.secret },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[n8n-export-audio] webhook ${res.status}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as
      | { audio_base64?: string; duration_seconds?: number; provider?: string }
      | null;
    if (!data?.audio_base64) return null;
    const audio = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
    return {
      audio,
      duration: data.duration_seconds ?? null,
      provider: data.provider ?? "n8n",
    };
  } catch (err) {
    console.warn("[n8n-export-audio] webhook failed:", (err as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return friendly("method_not_allowed", 405);

  // ── Auth ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return friendly("unauthorized", 401);
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: uData, error: uErr } = await userClient.auth.getUser();
  if (uErr || !uData?.user) return friendly("unauthorized", 401);
  const userId = uData.user.id;

  // ── Validate body ───────────────────────────────────────────────────
  let payload: ExportAudioRequest;
  try {
    payload = (await req.json()) as ExportAudioRequest;
  } catch {
    return friendly("invalid_json", 400);
  }
  if (!payload?.full_text?.trim()) return friendly("full_text_required", 400);
  if (payload.full_text.length > MAX_TEXT_CHARS) {
    return friendly("text_too_long", 400, { max_chars: MAX_TEXT_CHARS });
  }
  const language = (payload.language || "en").toLowerCase().slice(0, 5);
  const speed = payload.speed && payload.speed >= 0.5 && payload.speed <= 1.5 ? payload.speed : 1.0;
  const voiceId = payload.voice_id || `${language}-default`;

  // ── Rate limit ──────────────────────────────────────────────────────
  const rl = await checkRateLimit(`u:${userId}`, "export-audio", {
    windowSec: 3600,
    max: 5,
    blockSec: 600,
  });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // ── Content hash + cache lookup ────────────────────────────────────
  const hash = await contentHash(`${payload.full_text}|${voiceId}|${speed}|${language}`);
  const filename = `${slug(payload.title ?? "story")}.mp3`;
  const objectPath = `${userId}/${hash}.mp3`;

  // Insert the export row up-front so we always have an audit trail.
  const { data: exportRow, error: insertErr } = await admin
    .from("exports")
    .insert({
      user_id: userId,
      story_id: payload.story_id ?? null,
      child_id: payload.child_id ?? null,
      type: "mp3",
      language,
      status: "generating",
      metadata: { title: payload.title, child_name: payload.child_name, emotion_tags: payload.emotion_tags },
      audio_metadata: { voice_id: voiceId, speed, content_hash: hash },
    })
    .select("id")
    .single();
  if (insertErr || !exportRow) return friendly("db_insert_failed", 500);
  const exportId = exportRow.id as string;

  await admin.from("export_logs").insert({
    export_id: exportId, user_id: userId, action: "requested",
    ip_address: (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null,
    user_agent: req.headers.get("user-agent") ?? null,
    details: { chars: payload.full_text.length, voice_id: voiceId, speed },
  });

  const finalize = async (opts: {
    signedUrl: string; size: number; duration: number | null; provider: string; cacheHit: boolean;
  }) => {
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    await admin.from("exports").update({
      status: "ready",
      file_path: objectPath,
      signed_url: opts.signedUrl,
      file_size: opts.size,
      provider: opts.provider,
      expires_at: expiresAt,
      audio_metadata: { voice_id: voiceId, speed, content_hash: hash, duration: opts.duration, cache_hit: opts.cacheHit },
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "generated",
      details: { provider: opts.provider, duration: opts.duration, cache_hit: opts.cacheHit, bytes: opts.size },
    });
    return json({
      success: true, export_id: exportId, download_url: opts.signedUrl,
      file_name: filename, file_size: opts.size, duration_seconds: opts.duration,
      provider: opts.provider, expires_at: expiresAt, cache_hit: opts.cacheHit,
    });
  };

  // ── Cache hit path ─────────────────────────────────────────────────
  const { data: cached } = await admin
    .from("audio_cache")
    .select("id, file_path, provider, duration_seconds, file_size, used_count")
    .eq("content_hash", hash)
    .maybeSingle();

  if (cached?.file_path) {
    const signed = await admin.storage.from(BUCKET)
      .createSignedUrl(cached.file_path, SIGNED_URL_TTL_SECONDS, { download: filename });
    if (signed.data?.signedUrl) {
      await admin.from("audio_cache").update({
        used_count: (cached.used_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      }).eq("id", cached.id);
      return finalize({
        signedUrl: signed.data.signedUrl,
        size: cached.file_size ?? 0,
        duration: cached.duration_seconds ?? null,
        provider: cached.provider ?? "cache",
        cacheHit: true,
      });
    }
  }

  // ── Miss → n8n → fallback to in-house TTS service ─────────────────
  let audio: Uint8Array | null = null;
  let duration: number | null = null;
  let provider = "unknown";

  const n8n = await callN8n(payload);
  if (n8n) {
    audio = n8n.audio;
    duration = n8n.duration;
    provider = n8n.provider;
  } else {
    // Reuse the shared TTS service: it handles chunking, retries and
    // provider fallback (Edge-TTS → OpenAI TTS), uploads to story-audio,
    // and returns a public URL we can re-sign.
    try {
      const result = await generateSpeech({
        text: payload.full_text,
        language,
        voice: payload.voice_id,
        storyId: payload.story_id ?? undefined,
        userId,
        admin,
      });
      // Download the produced MP3 from the storage bucket so we can also
      // stamp our own hashed path + audio_cache row.
      const urlParts = result.audioUrl.split(`/${BUCKET}/`);
      const producedPath = urlParts[1] ?? "";
      if (producedPath) {
        const { data: dl } = await admin.storage.from(BUCKET).download(producedPath);
        if (dl) {
          audio = new Uint8Array(await dl.arrayBuffer());
          duration = result.duration ?? null;
          provider = result.provider ?? "local-fallback";
        }
      }
    } catch (err) {
      console.error("[n8n-export-audio] shared TTS failed:", (err as Error).message);
    }
  }

  if (!audio) {
    await admin.from("exports").update({ status: "failed", error_message: "tts_pipeline_failed" }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "failed",
      details: { stage: "tts", n8n_configured: !!N8N_WEBHOOK_URL },
    });
    return friendly("tts_pipeline_failed", 502);
  }

  // ── Upload to storage under hashed path ───────────────────────────
  const up = await admin.storage.from(BUCKET).upload(objectPath, audio, {
    contentType: "audio/mpeg", upsert: true,
  });
  if (up.error) {
    await admin.from("exports").update({ status: "failed", error_message: up.error.message }).eq("id", exportId);
    return friendly("storage_upload_failed", 500);
  }

  // ── audio_cache upsert ────────────────────────────────────────────
  await admin.from("audio_cache").upsert({
    content_hash: hash,
    file_path: objectPath,
    provider,
    voice_id: voiceId,
    language,
    duration_seconds: duration,
    file_size: audio.byteLength,
    used_count: 1,
    last_used_at: new Date().toISOString(),
  }, { onConflict: "content_hash" });

  const signed = await admin.storage.from(BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (!signed.data?.signedUrl) return friendly("sign_url_failed", 500);

  return finalize({
    signedUrl: signed.data.signedUrl,
    size: audio.byteLength,
    duration,
    provider,
    cacheHit: false,
  });
});
