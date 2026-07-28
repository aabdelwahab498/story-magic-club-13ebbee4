import { supabase } from "@/integrations/supabase/client";
import { axiosInstance } from "@/api/client";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _readEdgeError(error: unknown): Promise<StoryExportError> {
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

export async function exportStoryAsTxt(_input: ExportTxtInput): Promise<ExportTxtResult> {
  throw new Error("Text export is not yet migrated to Backend Core");
}

export async function exportStoryAsAudio(_input: ExportAudioInput): Promise<ExportAudioResult> {
  throw new Error("Audio export is not yet migrated to Backend Core");
}

export async function exportStoryAsPdf(input: ExportPdfInput): Promise<ExportPdfResult> {
  if (!input.storyId) {
    throw new Error("Story must be saved before exporting to PDF.");
  }
  try {
    const response = await axiosInstance.post<{ download_url?: string }>(`/media/stories/${input.storyId}/export/pdf`);
    const url = response.data.download_url;
    if (!url) throw new Error("no_pdf_url");
    return {
      exportId: "migrated_" + input.storyId,
      downloadUrl: url,
      fileName: `${input.title || "story"}.pdf`,
      previewUrl: url,
      fileSize: 0,
      pageCount: input.pages.length,
      provider: "google",
      expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    };
  } catch (err: any) {
    const msg = err.response?.data?.message || err.message || "Failed to export PDF";
    throw new StoryExportError(msg);
  }
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