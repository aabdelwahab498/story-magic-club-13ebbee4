import { supabase } from "@/integrations/supabase/client";


export type ExportKind = "txt" | "mp3" | "pdf";
export type SupportedLanguage = "ar" | "en" | "fr" | "de" | "es" | "pt" | string;

export interface ExportTxtInput {
  storyId?: string | null;
  childId?: string | null;
  title: string;
  fullText: string;
  language: SupportedLanguage;
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
  provider: string;
  dapScore: number | null;
}

export interface ExportAudioInput {
  storyId?: string | null;
  childId?: string | null;
  title?: string;
  fullText: string;
  language: SupportedLanguage;
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
  language: SupportedLanguage;
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

export class StoryExportError extends Error {
  code: string;
  status?: number;
  retryAfter?: number;
  constructor(code: string, message?: string, opts?: { status?: number; retryAfter?: number }) {
    super(message ?? code);
    this.name = "StoryExportError";
    this.code = code;
    this.status = opts?.status;
    this.retryAfter = opts?.retryAfter;
  }
}

type EdgeErrorBody = { error?: string; code?: string; retry_after?: number; message?: string };

export async function readEdgeError(error: unknown): Promise<StoryExportError> {
  let code = "network_error";
  let message = (error as Error)?.message;
  let status: number | undefined;
  let retryAfter: number | undefined;
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.text === "function") {
    status = ctx.status;
    const body = await ctx.text();
    try {
      const parsed = JSON.parse(body) as EdgeErrorBody;
      code = parsed.error ?? parsed.code ?? code;
      retryAfter = parsed.retry_after;
      message = parsed.message ?? message;
    } catch {
      code = body?.slice(0, 120) || code;
    }
  }
  return new StoryExportError(code, message, { status, retryAfter });
}

export async function exportStoryAsTxt(input: ExportTxtInput): Promise<ExportTxtResult> {
  const { data, error } = await supabase.functions.invoke("export-story-txt", {
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
  if (error) throw await readEdgeError(error);
  if (!data?.success) throw new StoryExportError(data?.error ?? "txt_export_failed", data?.message);
  return {
    exportId: data.export_id,
    downloadUrl: data.download_url,
    fileName: data.file_name,
    fileSize: data.file_size ?? 0,
    expiresAt: data.expires_at,
    provider: data.provider ?? "local",
    dapScore: data.dap_score ?? null,
  };
}

export async function exportStoryAsAudio(input: ExportAudioInput): Promise<ExportAudioResult> {
  const { data, error } = await supabase.functions.invoke("export-story-audio", {
    body: {
      story_id: input.storyId ?? null,
      child_id: input.childId ?? null,
      title: input.title,
      full_text: input.fullText,
      language: input.language,
      voice_id: input.voiceId,
      speed: input.speed,
      child_name: input.childName ?? null,
      emotion_tags: input.emotionTags ?? [],
    },
  });
  if (error) throw await readEdgeError(error);
  if (!data?.success) throw new StoryExportError(data?.error ?? "audio_export_failed", data?.message);
  return {
    exportId: data.export_id,
    downloadUrl: data.download_url,
    fileName: data.file_name,
    fileSize: data.file_size ?? 0,
    durationSeconds: data.duration_seconds ?? null,
    provider: data.provider ?? "local",
    cacheHit: data.cache_hit === true,
    expiresAt: data.expires_at,
  };
}

export async function exportStoryAsPdf(input: ExportPdfInput): Promise<ExportPdfResult> {
  // Canonical authenticated story → Backend Core illustrated export. It waits for
  // the story-media worker, so the book is never a text-only browser fallback.
  if (input.storyId) {
    try {
      const result = await waitForCanonicalStoryPdf(input.storyId);
      const fileName =
        result.filename ??
        `${(input.title || "story").replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60) || "story"}.pdf`;
      return {
        exportId: input.storyId,
        downloadUrl: result.download_url ?? "",
        previewUrl: null,
        fileName,
        fileSize: null,
        pageCount: input.pages?.length ?? null,
        provider: "backend-core",
        expiresAt: "",
      };
    } catch (err) {
      const code = err instanceof CanonicalExportError ? err.code : "pdf_render_failed";
      throw new StoryExportError(code, (err as Error)?.message);
    }
  }
  const { data, error } = await supabase.functions.invoke("export-story-pdf", {
    body: {
      storyId: input.storyId ?? undefined,
      story_id: input.storyId ?? null,
      child_id: input.childId ?? null,
      title: input.title,
      pages: input.pages.map((p) => ({
        page_number: p.pageNumber,
        text: p.text,
        illustration_url: p.illustrationUrl ?? null,
        emotion_tag: p.emotionTag ?? null,
      })),
      language: input.language,
      child_name: input.childName ?? null,
      theme_color: input.themeColor ?? null,
      emotion_tags: input.emotionTags ?? [],
    },
  });
  if (error) throw await readEdgeError(error);
  if (!data?.success) throw new StoryExportError(data?.error ?? "pdf_export_failed", data?.message);
  return {
    exportId: data.export_id,
    downloadUrl: data.download_url,
    previewUrl: data.preview_url ?? null,
    fileName: data.file_name,
    fileSize: data.file_size ?? null,
    pageCount: data.page_count ?? input.pages.length,
    provider: data.provider ?? "local",
    expiresAt: data.expires_at,
  };
}


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
    // best-effort audit only
  }
}