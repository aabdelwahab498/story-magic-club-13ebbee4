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
