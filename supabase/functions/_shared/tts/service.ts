// TTS service layer — provider-agnostic orchestration with fallback chain.
//
// Responsibilities:
//   • Language auto-detection (Arabic vs English)
//   • Deterministic cache key (sha256 of text+voice+language+provider)
//     → identical inputs always reuse the same MP3 in Supabase Storage
//   • Text chunking + per-chunk retry with exponential backoff
//   • Provider fallback: try each configured provider in order until one
//     succeeds; the final failure is surfaced to the caller
//   • MP3 stream concatenation into one downloadable file
//   • Structured result: status, audioUrl, duration, providersAttempted, ...
//   • Structured logging and safe user-facing error messages

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { edgeTtsProvider } from "./edgeProvider.ts";
import { openaiTtsProvider } from "./openaiProvider.ts";
import { TtsError } from "./types.ts";
import type { GenerateSpeechResult, TtsProvider, TtsStatus } from "./types.ts";
import {
  chunkText,
  computeCacheKey,
  concatMp3,
  detectLanguage,
  withRetry,
} from "./logic.ts";

// ─── Configuration ──────────────────────────────────────────────────────────
const BUCKET = "story-audio";
const MAX_INPUT_CHARS = 20_000;
const CHUNK_MAX_ATTEMPTS = 3;
const MP3_BYTES_PER_SECOND = 6000; // 48 kbps mono
export const AUDIO_TTL_DAYS = 30;

/**
 * Ordered provider chain — first entry is the primary. Adding ElevenLabs or
 * Azure Speech means implementing `TtsProvider` and appending it here; no
 * other file changes required.
 */
export const providerChain: TtsProvider[] = [edgeTtsProvider, openaiTtsProvider];

// ─── Helpers ────────────────────────────────────────────────────────────────
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
  console.log(JSON.stringify({ scope: "tts", event, ...data }));
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface GenerateSpeechArgs {
  text: string;
  language?: string;
  voice?: string;
  /** Optional client-supplied id (kept for logs; cache is content-hash based). */
  storyId?: string;
  userId: string;
  admin?: SupabaseClient;
  signal?: AbortSignal;
}

/**
 * Synthesize `text` to MP3, upload to Supabase Storage, return a downloadable
 * URL + rich metadata (status, provider tried, chunkCount, etc.).
 *
 * Always throws {@link TtsError} on total failure. Callers should map
 * `code` → user message and never expose raw errors.
 */
export async function generateSpeech(
  args: GenerateSpeechArgs,
): Promise<GenerateSpeechResult> {
  const rawText = (args.text ?? "").toString();
  if (!rawText.trim()) throw new TtsError("invalid_input", "Missing story text.");
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
  const admin = args.admin ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const attempted: string[] = [];
  let lastError: TtsError | null = null;

  for (const provider of providerChain) {
    const voice = pickVoice(provider, language, args.voice);
    const cacheKey = await computeCacheKey({
      text: rawText,
      voice,
      language,
      provider: provider.id,
    });
    const filename = `${cacheKey}.mp3`;
    const path = `${args.userId}/${filename}`;

    // ─ Cache check (content-hash based; identical inputs reuse the file) ─
    try {
      const { data: listed } = await admin.storage
        .from(BUCKET)
        .list(args.userId, { search: filename });
      const hit = listed?.find((f) => f.name === filename);
      if (hit) {
        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
        const size = (hit.metadata as { size?: number } | null)?.size ?? 0;
        log("cache_hit", { provider: provider.id, path, size, cacheKey });
        return buildResult({
          status: "cached",
          audioUrl: pub.publicUrl,
          fileSize: size,
          voice,
          provider: provider.id,
          language,
          chunkCount: 0,
          cacheKey,
          providersAttempted: [...attempted, provider.id],
        });
      }
    } catch (e) {
      log("cache_lookup_failed", { provider: provider.id, error: String(e) });
    }

    // ─ Try this provider ─
    attempted.push(provider.id);
    try {
      const chunks = chunkText(rawText, provider.maxChunkChars);
      log("synthesize_start", {
        provider: provider.id,
        chars: rawText.length,
        chunks: chunks.length,
        voice,
        language,
        cacheKey,
      });
      const started = Date.now();
      const audioParts: Uint8Array[] = [];
      for (const [i, chunk] of chunks.entries()) {
        const bytes = await withRetry(
          () => provider.synthesize({ text: chunk, voice, signal: args.signal }),
          {
            attempts: CHUNK_MAX_ATTEMPTS,
            signal: args.signal,
            onAttempt: (attempt, error) =>
              log("chunk_retry", {
                provider: provider.id,
                attempt,
                chars: chunk.length,
                error: String(error),
              }),
          },
        );
        audioParts.push(bytes);
        log("chunk_done", {
          provider: provider.id,
          index: i + 1,
          of: chunks.length,
          bytes: bytes.length,
        });
      }
      const merged = concatMp3(audioParts);

      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, merged, { contentType: "audio/mpeg", upsert: true });
      if (upErr) {
        throw new TtsError(
          "storage_upload_failed",
          "Could not save the audio file. Please try again.",
          upErr,
          { provider: provider.id },
        );
      }
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      log("synthesize_ok", {
        provider: provider.id,
        path,
        bytes: merged.length,
        ms: Date.now() - started,
      });
      const status: TtsStatus = attempted.length > 1 ? "fallback" : "success";
      return buildResult({
        status,
        audioUrl: pub.publicUrl,
        fileSize: merged.length,
        voice,
        provider: provider.id,
        language,
        chunkCount: chunks.length,
        cacheKey,
        providersAttempted: [...attempted],
      });
    } catch (e) {
      lastError = e instanceof TtsError
        ? e
        : new TtsError(
          "tts_upstream_failed",
          "Voice generation failed. Please try again.",
          e,
          { provider: provider.id },
        );
      log("provider_failed", {
        provider: provider.id,
        code: lastError.code,
        error: String(e),
      });
      // Non-retryable errors that are content-related (invalid input etc.)
      // shouldn't cascade through the chain.
      if (!lastError.retryable) break;
      // Otherwise try the next provider.
    }
  }

  throw lastError ??
    new TtsError("tts_upstream_failed", "Voice generation failed. Please try again.");
}

function buildResult(r: Omit<GenerateSpeechResult, "duration">): GenerateSpeechResult {
  return { ...r, duration: Math.round(r.fileSize / MP3_BYTES_PER_SECOND) };
}

/**
 * Delete generated audio older than {@link AUDIO_TTL_DAYS} days.
 * Invoked by the `cleanup-story-audio` scheduled function.
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
  if (toDelete.length > 0) await client.storage.from(BUCKET).remove(toDelete);
  log("cleanup", { scanned, deleted: toDelete.length, ttlDays: AUDIO_TTL_DAYS });
  return { deleted: toDelete.length, scanned };
}

export { TtsError } from "./types.ts";
export type { GenerateSpeechResult, TtsProvider } from "./types.ts";
