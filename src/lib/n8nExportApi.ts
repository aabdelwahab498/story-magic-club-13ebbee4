// ============================================================================
// n8n Export API — TypeScript client for the n8n-powered export pipeline.
// ----------------------------------------------------------------------------
// The client talks to Supabase Edge Functions (which act as secure proxies to
// n8n), never to the n8n webhook directly. This keeps the webhook secret on
// the server and lets us centralize auth, rate-limiting and audit logging.
// ============================================================================

import { supabase } from "@/integrations/supabase/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
export type ExportKind = "txt" | "mp3" | "pdf";

export type SupportedLanguage = "ar" | "en" | "fr" | "de" | "es" | "pt";

export interface ExportTxtInput {
  storyId?: string | null;
  childId?: string | null;
  title: string;
  fullText: string;
  language: SupportedLanguage | string;
  childName?: string | null;
  emotionTags?: string[];
  pageCount?: number;
}

export interface ExportTxtResult {
  exportId: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  expiresAt: string;
  provider: "n8n" | "local-fallback";
  dapScore: number | null;
}

/**
 * Discriminated error thrown by the n8n export client.
 * The `code` field is a stable machine-readable identifier the UI maps to a
 * kid-friendly, i18n-ready message.
 */
export class N8nExportError extends Error {
  code: string;
  status?: number;
  retryAfter?: number;
  constructor(code: string, message?: string, opts?: { status?: number; retryAfter?: number }) {
    super(message ?? code);
    this.name = "N8nExportError";
    this.code = code;
    this.status = opts?.status;
    this.retryAfter = opts?.retryAfter;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// TXT export
// ────────────────────────────────────────────────────────────────────────────

/**
 * Trigger the n8n TXT export workflow via the edge-function proxy.
 * Returns a short-lived signed download URL.
 */
export async function exportStoryAsTxt(input: ExportTxtInput): Promise<ExportTxtResult> {
  if (!input.fullText?.trim()) {
    throw new N8nExportError("empty_text", "Story text is empty.");
  }
  if (input.fullText.length > 10_000) {
    throw new N8nExportError("text_too_long", "Story text exceeds 10,000 characters.");
  }

  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    export_id?: string;
    download_url?: string;
    file_name?: string;
    file_size?: number;
    expires_at?: string;
    provider?: "n8n" | "local-fallback";
    dap_score?: number | null;
    error?: string;
    retry_after?: number;
  }>("n8n-export-txt", {
    body: {
      story_id: input.storyId ?? null,
      child_id: input.childId ?? null,
      title: input.title,
      full_text: input.fullText,
      language: input.language,
      child_name: input.childName ?? null,
      emotion_tags: input.emotionTags ?? [],
      page_count: input.pageCount ?? null,
    },
  });

  // supabase-js flattens non-2xx into `error` with a generic message.
  // Read the real body via the response context when available.
  if (error) {
    let code = "network_error";
    let status: number | undefined;
    let retryAfter: number | undefined;
    // `error.context` may be a Response for FunctionsHttpError.
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.text === "function") {
      status = ctx.status;
      const body = await ctx.text();
      try {
        const parsed = JSON.parse(body) as { error?: string; retry_after?: number };
        code = parsed.error ?? code;
        retryAfter = parsed.retry_after;
      } catch {
        code = body?.slice(0, 120) || code;
      }
    }
    throw new N8nExportError(code, error.message, { status, retryAfter });
  }

  if (!data?.success || !data.download_url || !data.export_id) {
    throw new N8nExportError(data?.error ?? "unknown_error", "Export failed.");
  }

  return {
    exportId: data.export_id,
    downloadUrl: data.download_url,
    fileName: data.file_name ?? "story.txt",
    fileSize: data.file_size ?? 0,
    expiresAt: data.expires_at ?? new Date(Date.now() + 24 * 3600_000).toISOString(),
    provider: data.provider ?? "n8n",
    dapScore: data.dap_score ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Shared helper — normalize supabase.functions.invoke error into N8nExportError
// ────────────────────────────────────────────────────────────────────────────
async function readEdgeError(error: unknown): Promise<N8nExportError> {
  let code = "network_error";
  let status: number | undefined;
  let retryAfter: number | undefined;
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.text === "function") {
    status = ctx.status;
    const body = await ctx.text();
    try {
      const parsed = JSON.parse(body) as { error?: string; retry_after?: number };
      code = parsed.error ?? code;
      retryAfter = parsed.retry_after;
    } catch {
      code = body?.slice(0, 120) || code;
    }
  }
  return new N8nExportError(code, (error as Error)?.message, { status, retryAfter });
}

// ────────────────────────────────────────────────────────────────────────────
// Audio (MP3) export
// ────────────────────────────────────────────────────────────────────────────
export interface ExportAudioInput {
  storyId?: string | null;
  childId?: string | null;
  title?: string;
  fullText: string;
  language: SupportedLanguage | string;
  voiceId?: string;
  speed?: 0.8 | 1.0 | 1.2 | number;
  childName?: string | null;
  emotionTags?: string[];
}

export interface ExportAudioResult {
  exportId: string;
  downloadUrl: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number | null;
  provider: string;
  cacheHit: boolean;
  expiresAt: string;
}

export async function exportStoryAsAudio(input: ExportAudioInput): Promise<ExportAudioResult> {
  if (!input.fullText?.trim()) throw new N8nExportError("empty_text");
  if (input.fullText.length > 10_000) throw new N8nExportError("text_too_long");

  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    export_id?: string;
    download_url?: string;
    file_name?: string;
    file_size?: number;
    duration_seconds?: number | null;
    provider?: string;
    cache_hit?: boolean;
    expires_at?: string;
    error?: string;
  }>("n8n-export-audio", {
    body: {
      story_id: input.storyId ?? null,
      child_id: input.childId ?? null,
      title: input.title ?? "story",
      full_text: input.fullText,
      language: input.language,
      voice_id: input.voiceId,
      speed: input.speed ?? 1.0,
      child_name: input.childName ?? null,
      emotion_tags: input.emotionTags ?? [],
    },
  });

  if (error) throw await readEdgeError(error);
  if (!data?.success || !data.download_url || !data.export_id) {
    throw new N8nExportError(data?.error ?? "unknown_error");
  }

  return {
    exportId: data.export_id,
    downloadUrl: data.download_url,
    fileName: data.file_name ?? "story.mp3",
    fileSize: data.file_size ?? 0,
    durationSeconds: data.duration_seconds ?? null,
    provider: data.provider ?? "n8n",
    cacheHit: data.cache_hit ?? false,
    expiresAt: data.expires_at ?? new Date(Date.now() + 24 * 3600_000).toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// PDF (Picture Book) export
// ────────────────────────────────────────────────────────────────────────────
export interface PdfPageInput {
  pageNumber: number;
  text: string;
  illustrationUrl?: string | null;
  emotionTag?: string | null;
}

export interface ExportPdfInput {
  storyId?: string | null;
  childId?: string | null;
  title: string;
  pages: PdfPageInput[];
  language: SupportedLanguage | string;
  childName?: string | null;
  themeColor?: string | null;
  fontFamily?: string | null;
  emotionTags?: string[];
}

export interface ExportPdfResult {
  exportId: string;
  downloadUrl: string;
  previewUrl: string | null;
  fileName: string;
  fileSize: number | null;
  pageCount: number | null;
  provider: string;
  expiresAt: string;
}

export async function exportStoryAsPdf(input: ExportPdfInput): Promise<ExportPdfResult> {
  if (!input.pages?.length) throw new N8nExportError("pages_required");
  if (input.pages.length > 30) throw new N8nExportError("too_many_pages");

  const { data, error } = await supabase.functions.invoke<{
    success?: boolean;
    export_id?: string;
    download_url?: string;
    preview_url?: string | null;
    file_name?: string;
    file_size?: number | null;
    page_count?: number | null;
    provider?: string;
    expires_at?: string;
    error?: string;
  }>("n8n-export-pdf", {
    body: {
      story_id: input.storyId ?? null,
      child_id: input.childId ?? null,
      title: input.title,
      language: input.language,
      child_name: input.childName ?? null,
      theme_color: input.themeColor ?? null,
      font_family: input.fontFamily ?? null,
      emotion_tags: input.emotionTags ?? [],
      pages: input.pages.map((p) => ({
        page_number: p.pageNumber,
        text: p.text,
        illustration_url: p.illustrationUrl ?? null,
        emotion_tag: p.emotionTag ?? null,
      })),
    },
  });

  if (error) throw await readEdgeError(error);
  if (!data?.success || !data.download_url || !data.export_id) {
    throw new N8nExportError(data?.error ?? "unknown_error");
  }

  return {
    exportId: data.export_id,
    downloadUrl: data.download_url,
    previewUrl: data.preview_url ?? null,
    fileName: data.file_name ?? "story.pdf",
    fileSize: data.file_size ?? null,
    pageCount: data.page_count ?? null,
    provider: data.provider ?? "n8n",
    expiresAt: data.expires_at ?? new Date(Date.now() + 24 * 3600_000).toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Voice catalog (from voice_configs)
// ────────────────────────────────────────────────────────────────────────────
export interface VoiceConfig {
  id: string;
  languageCode: string;
  voiceId: string;
  displayName: string | null;
  provider: string;
  gender: "male" | "female" | "neutral" | null;
  ageGroup: "child" | "teen" | "adult" | null;
  isDefault: boolean;
  sampleUrl: string | null;
}

export async function listVoicesForLanguage(lang: string): Promise<VoiceConfig[]> {
  const { data, error } = await supabase
    .from("voice_configs")
    .select("id, language_code, voice_id, display_name, provider, gender, age_group, is_default, sample_url")
    .eq("language_code", lang.toLowerCase().slice(0, 2))
    .eq("is_active", true)
    .order("is_default", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    languageCode: r.language_code as string,
    voiceId: r.voice_id as string,
    displayName: r.display_name as string | null,
    provider: r.provider as string,
    gender: r.gender as VoiceConfig["gender"],
    ageGroup: r.age_group as VoiceConfig["ageGroup"],
    isDefault: r.is_default as boolean,
    sampleUrl: r.sample_url as string | null,
  }));
}

/**
 * Client-side audit — records that the user actually initiated the download
 * (edge function already logs generation). Best-effort; never throws.
 */
export async function logExportDownloaded(exportId: string): Promise<void> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("export_logs").insert({
      export_id: exportId,
      user_id: userData.user?.id ?? null,
      action: "downloaded",
      user_agent: navigator.userAgent,
      details: {},
    });
  } catch {
    /* best-effort */
  }
}
