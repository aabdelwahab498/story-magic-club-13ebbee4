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

export type TtsStatus = "success" | "cached";

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
  /** Provider id used. */
  provider: string;
  /** Detected/normalized language ("ar" or "en"). */
  language: string;
  /** Number of chunks synthesized (>=1). */
  chunkCount: number;
}

export type TtsErrorCode =
  | "invalid_input"
  | "text_too_long"
  | "unauthorized"
  | "tts_upstream_failed"
  | "tts_timeout"
  | "storage_upload_failed"
  | "internal_error";

export class TtsError extends Error {
  code: TtsErrorCode;
  /** User-safe message (no server internals). */
  userMessage: string;
  constructor(code: TtsErrorCode, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "TtsError";
    this.code = code;
    this.userMessage = userMessage;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}
