// Pure, runtime-agnostic TTS helpers.
//
// Contains ONLY web-standard APIs (TextEncoder, crypto.subtle, setTimeout)
// so the same code runs in Supabase Edge Functions (Deno) and in Vitest
// (Node 20+). Do not import Deno-specific or Supabase-specific modules
// here — keep this file trivially unit-testable.

import { TtsError, type TtsErrorCode } from "./types.ts";

// ─── Language detection ─────────────────────────────────────────────────────
export function detectLanguage(text: string, hint?: string): "ar" | "en" {
  if (hint && hint.toLowerCase().startsWith("ar")) return "ar";
  if (hint && hint.toLowerCase().startsWith("en")) return "en";
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  return arabic > text.length * 0.15 ? "ar" : "en";
}

// ─── Chunking ───────────────────────────────────────────────────────────────
/**
 * Split text on sentence/paragraph boundaries into chunks ≤ `maxLen`.
 * Guarantees no chunk exceeds `maxLen` (hard-splits long sentences).
 */
export function chunkText(text: string, maxLen = 2800): string[] {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];
  const sentences = clean.split(/(?<=[.!?؟\n])\s+/);
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > maxLen && buf) {
      parts.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? buf + " " + s : s;
    }
  }
  if (buf) parts.push(buf.trim());
  const final: string[] = [];
  for (const p of parts) {
    if (p.length <= maxLen) { final.push(p); continue; }
    for (let i = 0; i < p.length; i += maxLen) final.push(p.slice(i, i + maxLen));
  }
  return final;
}

// ─── Deterministic cache key ────────────────────────────────────────────────
/**
 * SHA-256 hex digest of the normalized inputs. Identical text+voice+language
 * (+optional provider) always yields the same key → same storage path →
 * guaranteed reuse across chunks and requests.
 */
export async function computeCacheKey(input: {
  text: string;
  voice: string;
  language: string;
  provider?: string;
}): Promise<string> {
  const norm = [
    (input.text ?? "").replace(/\s+/g, " ").trim(),
    (input.voice ?? "").trim().toLowerCase(),
    (input.language ?? "").trim().toLowerCase(),
    (input.provider ?? "").trim().toLowerCase(),
  ].join("|");
  const bytes = new TextEncoder().encode(norm);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Retry with exponential backoff ─────────────────────────────────────────
export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  onAttempt?: (attempt: number, error: unknown) => void;
}

/**
 * Retry `fn` up to `attempts` times with exponential backoff.
 * Aborts immediately if a `TtsError` marked non-retryable is thrown.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    if (opts.signal?.aborted) {
      throw new TtsError("tts_upstream_failed", "Request aborted.");
    }
    try {
      return await fn(i);
    } catch (e) {
      lastErr = e;
      if (e instanceof TtsError && e.retryable === false) throw e;
      opts.onAttempt?.(i, e);
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, base * 2 ** (i - 1)));
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

// ─── User-facing error mapping ──────────────────────────────────────────────
const USER_MESSAGES: Record<TtsErrorCode, string> = {
  invalid_input: "Missing story text.",
  text_too_long: "Story is too long for MP3 export.",
  unauthorized: "Please sign in to download the audio.",
  tts_upstream_failed:
    "Voice generation is temporarily unavailable. Please try again in a moment.",
  tts_timeout: "Voice generation took too long. Please try again.",
  storage_upload_failed: "Could not save the audio file. Please try again.",
  internal_error: "Something went wrong. Please try again.",
};

export function mapErrorToUserMessage(code: TtsErrorCode): string {
  return USER_MESSAGES[code] ?? USER_MESSAGES.internal_error;
}

/** Concatenate MP3 byte streams. Safe because each chunk is a full MP3 frame set. */
export function concatMp3(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
