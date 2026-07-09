// Provider-agnostic types for the TTS service layer.
// Swapping to a new provider (Azure, ElevenLabs, Google Cloud TTS) means
// implementing `TtsProvider` and registering it in `service.ts` — nothing
// else in the app changes.

export interface TtsSynthesizeOpts {
  text: string;
  voice: string;
  rate?: string; // e.g. "+0%"
  pitch?: string; // e.g. "+0Hz"
  volume?: string; // e.g. "+0%"
  signal?: AbortSignal;
}

/**
 * A single-chunk TTS synthesizer. Implementations MUST return valid MP3
 * bytes (frame-concatenation safe) so the service layer can merge multiple
 * chunks into one downloadable file.
 */
export interface TtsProvider {
  /** Provider identifier, e.g. "edge-tts". Used in logs and filenames. */
  readonly id: string;

  /** Human-readable name for UI. */
  readonly displayName: string;

  /** Max characters this provider accepts per single request. */
  readonly maxChunkChars: number;

  /** Available voices grouped by language prefix (e.g. "ar", "en"). */
  readonly voicesByLang: Record<string, string[]>;

  /** Synthesize a single (already-chunked) piece of text to MP3 bytes. */
  synthesize(opts: TtsSynthesizeOpts): Promise<Uint8Array>;
}

export type TtsStatus = "success" | "cached" | "fallback";

export interface GenerateSpeechResult {
  status: TtsStatus;
  /** Publicly downloadable URL (Supabase Storage). */
  audioUrl: string;
  /** MP3 byte size. */
  fileSize: number;
  /** Estimated duration in seconds. */
  duration: number;
  /** Voice actually used (after fallback). */
  voice: string;
  /** Provider id used to produce the returned audio. */
  provider: string;
  /** Detected/normalized language ("ar" or "en"). */
  language: string;
  /** Number of chunks synthesized (0 when served from cache). */
  chunkCount: number;
  /** Deterministic sha256 hash of text+voice+language+provider. */
  cacheKey: string;
  /** Ordered list of provider ids that were tried this request. */
  providersAttempted: string[];
}

export type TtsErrorCode =
  | "invalid_input"
  | "text_too_long"
  | "unauthorized"
  | "tts_upstream_failed"
  | "tts_timeout"
  | "storage_upload_failed"
  | "internal_error";

const RETRYABLE_CODES: ReadonlySet<TtsErrorCode> = new Set([
  "tts_upstream_failed",
  "tts_timeout",
  "storage_upload_failed",
]);

export class TtsError extends Error {
  code: TtsErrorCode;
  /** User-safe message (no server internals). */
  userMessage: string;
  /** True when the caller can safely retry the same request. */
  retryable: boolean;
  /** Provider id that raised the error, if known. */
  provider?: string;
  constructor(
    code: TtsErrorCode,
    userMessage: string,
    cause?: unknown,
    opts?: { provider?: string; retryable?: boolean },
  ) {
    super(userMessage);
    this.name = "TtsError";
    this.code = code;
    this.userMessage = userMessage;
    this.retryable = opts?.retryable ?? RETRYABLE_CODES.has(code);
    this.provider = opts?.provider;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}
