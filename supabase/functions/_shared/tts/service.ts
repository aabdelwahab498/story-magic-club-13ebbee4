// TTS service layer — provider-agnostic orchestration.
//
// The rest of the application should only import from this file. Swapping
// providers (Azure Speech, ElevenLabs, Google Cloud TTS…) means writing a
// new `TtsProvider` and passing it here; no consumer changes required.
//
// Responsibilities:
//   • Language auto-detection (Arabic vs English) with per-language voice pools
//   • Text chunking + per-chunk retry with exponential backoff
//   • MP3 stream concatenation into one downloadable file
//   • Supabase Storage upload with deterministic cache keys
//   • Structured result: { status, audioUrl, duration, fileSize, ... }
//   • Structured logging and safe user-facing error messages

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chunkText, edgeTtsProvider } from "./edgeProvider.ts";
import { TtsError } from "./types.ts";
import type { GenerateSpeechResult, TtsProvider } from "./types.ts";

// ─── Configuration ──────────────────────────────────────────────────────────
const BUCKET = "story-audio";
const MAX_INPUT_CHARS = 20_000;
const CHUNK_MAX_ATTEMPTS = 3;
// Estimated duration for `audio-24khz-48kbitrate-mono-mp3`:
// 48 kbps → 6000 bytes per second.
const MP3_BYTES_PER_SECOND = 6000;
// Auto-cleanup threshold used by the cleanup job.
export const AUDIO_TTL_DAYS = 30;

// The active provider. Change this single line to swap providers.
export const activeProvider: TtsProvider = edgeTtsProvider;

// ─── Helpers ────────────────────────────────────────────────────────────────
function detectLanguage(text: string, hint?: string): "ar" | "en" {
  if (hint && hint.toLowerCase().startsWith("ar")) return "ar";
  if (hint && hint.toLowerCase().startsWith("en")) return "en";
  // Arabic Unicode block.
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabicChars > text.length * 0.15 ? "ar" : "en";
}

function pickVoice(
  provider: TtsProvider,
  language: "ar" | "en",
  requested?: string,
): string {
  const pool = provider.voicesByLang[language] ?? provider.voicesByLang.en;
  if (requested && pool.includes(requested)) return requested;
  return pool[0];
}

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({ scope: "tts", event, provider: activeProvider.id, ...data }),
  );
}

function concatMp3(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

async function synthesizeWithRetry(
  provider: TtsProvider,
  text: string,
  voice: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= CHUNK_MAX_ATTEMPTS; attempt++) {
    try {
      return await provider.synthesize({ text, voice, signal });
    } catch (e) {
      lastErr = e;
      log("chunk_retry", { attempt, chars: text.length, error: String(e) });
      if (attempt < CHUNK_MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastErr instanceof TtsError
    ? lastErr
    : new TtsError(
      "tts_upstream_failed",
      "Voice generation is temporarily unavailable. Please try again in a moment.",
      lastErr,
    );
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface GenerateSpeechArgs {
  text: string;
  language?: string;
  voice?: string;
  /** Optional stable ID used as cache key. Same id + voice → same file. */
  storyId?: string;
  /** Owner of the file — used to scope storage path and cache. */
  userId: string;
  /** Optional Supabase admin client; one is created if omitted. */
  admin?: SupabaseClient;
  signal?: AbortSignal;
}

/**
 * Provider-agnostic entry point: synthesize `text` to MP3, upload to
 * Supabase Storage, and return a downloadable URL + metadata.
 *
 * Always throws {@link TtsError} on failure — callers should map `code`
 * to a user-facing message and never expose raw errors.
 */
export async function generateSpeech(
  args: GenerateSpeechArgs,
): Promise<GenerateSpeechResult> {
  const rawText = (args.text ?? "").toString();
  if (!rawText.trim()) {
    throw new TtsError("invalid_input", "Missing story text.");
  }
  if (rawText.length > MAX_INPUT_CHARS) {
    throw new TtsError(
      "text_too_long",
      `Story is too long for MP3 export (limit ${MAX_INPUT_CHARS.toLocaleString()} characters).`,
    );
  }
  if (!args.userId) {
    throw new TtsError("unauthorized", "Please sign in to download the audio.");
  }

  const language = detectLanguage(rawText, args.language);
  const voice = pickVoice(activeProvider, language, args.voice);
  const admin = args.admin ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const filename = args.storyId
    ? `${args.storyId}-${voice}.mp3`
    : `oneoff-${crypto.randomUUID()}.mp3`;
  const path = `${args.userId}/${filename}`;

  // Cache check (only for stable story ids).
  if (args.storyId) {
    const { data: listed } = await admin.storage
      .from(BUCKET)
      .list(args.userId, { search: filename });
    const hit = listed?.find((f) => f.name === filename);
    if (hit) {
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      const size = (hit.metadata as { size?: number } | null)?.size ?? 0;
      log("cache_hit", { path, size });
      return {
        status: "cached",
        audioUrl: pub.publicUrl,
        fileSize: size,
        duration: Math.round(size / MP3_BYTES_PER_SECOND),
        voice,
        provider: activeProvider.id,
        language,
        chunkCount: 0,
      };
    }
  }

  // Synthesize — chunk, retry, merge.
  const chunks = chunkText(rawText, activeProvider.maxChunkChars);
  log("synthesize_start", { chars: rawText.length, chunks: chunks.length, voice, language });
  const started = Date.now();

  const audioParts: Uint8Array[] = [];
  for (const [i, chunk] of chunks.entries()) {
    const bytes = await synthesizeWithRetry(activeProvider, chunk, voice, args.signal);
    audioParts.push(bytes);
    log("chunk_done", { index: i + 1, of: chunks.length, bytes: bytes.length });
  }
  const merged = concatMp3(audioParts);

  // Upload to Supabase Storage.
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, merged, { contentType: "audio/mpeg", upsert: true });
  if (upErr) {
    log("upload_failed", { path, error: upErr.message });
    throw new TtsError(
      "storage_upload_failed",
      "Could not save the audio file. Please try again.",
      upErr,
    );
  }

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const duration = Math.round(merged.length / MP3_BYTES_PER_SECOND);
  log("synthesize_ok", {
    path,
    bytes: merged.length,
    duration,
    ms: Date.now() - started,
  });

  return {
    status: "success",
    audioUrl: pub.publicUrl,
    fileSize: merged.length,
    duration,
    voice,
    provider: activeProvider.id,
    language,
    chunkCount: chunks.length,
  };
}

/**
 * Delete generated audio older than {@link AUDIO_TTL_DAYS} days.
 * Intended to be called from a scheduled cleanup edge function.
 */
export async function cleanupExpiredAudio(admin?: SupabaseClient): Promise<{
  deleted: number;
  scanned: number;
}> {
  const client = admin ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const cutoff = Date.now() - AUDIO_TTL_DAYS * 24 * 60 * 60 * 1000;
  let scanned = 0;
  const toDelete: string[] = [];

  const { data: users } = await client.storage.from(BUCKET).list("", { limit: 1000 });
  for (const userFolder of users ?? []) {
    if (!userFolder.name) continue;
    const { data: files } = await client.storage
      .from(BUCKET)
      .list(userFolder.name, { limit: 1000 });
    for (const f of files ?? []) {
      scanned++;
      const created = f.created_at ? new Date(f.created_at).getTime() : Date.now();
      if (created < cutoff) toDelete.push(`${userFolder.name}/${f.name}`);
    }
  }
  if (toDelete.length > 0) {
    await client.storage.from(BUCKET).remove(toDelete);
  }
  log("cleanup", { scanned, deleted: toDelete.length, ttlDays: AUDIO_TTL_DAYS });
  return { deleted: toDelete.length, scanned };
}

export { TtsError } from "./types.ts";
export type { GenerateSpeechResult, TtsProvider } from "./types.ts";
