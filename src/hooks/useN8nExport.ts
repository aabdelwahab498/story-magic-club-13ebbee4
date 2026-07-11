// ============================================================================
// useN8nExport — React hook that drives the TXT / MP3 / PDF export flows.
// ----------------------------------------------------------------------------
// Exposes stateful `status`, `error`, and per-kind actions (`exportTxt`,
// `exportAudio`, `exportPdf`) plus a `busyKind` indicator so different
// buttons in the same toolbar can show independent loading states.
// ============================================================================

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  exportStoryAsTxt,
  exportStoryAsAudio,
  exportStoryAsPdf,
  logExportDownloaded,
  N8nExportError,
  type ExportTxtInput,
  type ExportTxtResult,
  type ExportAudioInput,
  type ExportAudioResult,
  type ExportPdfInput,
  type ExportPdfResult,
} from "@/lib/n8nExportApi";

export type ExportKind = "txt" | "mp3" | "pdf";
export type ExportStatus = "idle" | "preparing" | "ready" | "error";

/** Per-kind runtime info shown as a badge on each export button. */
export interface KindInfo {
  /** Which backend actually served the last successful export. */
  lastProvider: string | null;
  /** Whether that export bypassed n8n and used the local fallback. */
  lastUsedFallback: boolean;
  /** Machine-readable error code from the last failure (null when clear). */
  lastErrorCode: string | null;
  /** Localized error message from the last failure. */
  lastError: string | null;
}

const EMPTY_KIND: KindInfo = {
  lastProvider: null,
  lastUsedFallback: false,
  lastErrorCode: null,
  lastError: null,
};

interface State {
  status: ExportStatus;
  busyKind: ExportKind | null;
  lastResult: ExportTxtResult | ExportAudioResult | ExportPdfResult | null;
  lastKind: ExportKind | null;
  error: string | null;
  errorCode: string | null;
  retryAfter?: number;
  kinds: Record<ExportKind, KindInfo>;
}

const INITIAL: State = {
  status: "idle",
  busyKind: null,
  lastResult: null,
  lastKind: null,
  error: null,
  errorCode: null,
  kinds: { txt: { ...EMPTY_KIND }, mp3: { ...EMPTY_KIND }, pdf: { ...EMPTY_KIND } },
};

function useFriendlyError() {
  const { t } = useTranslation();
  return useCallback(
    (code: string): string => {
      switch (code) {
        case "empty_text":            return t("exports.errors.empty_text", "There's nothing to export yet.");
        case "text_too_long":         return t("exports.errors.text_too_long", "The story is a bit too long — please shorten it.");
        case "pages_required":        return t("exports.errors.pages_required", "This story has no pages yet.");
        case "too_many_pages":        return t("exports.errors.too_many_pages", "Please shorten the story to 30 pages or fewer.");
        case "unauthorized":          return t("exports.errors.unauthorized", "Please sign in to download your story.");
        case "rate_limited":
        case "blocked":               return t("exports.errors.rate_limited", "You've made too many exports. Try again soon.");
        case "invalid_language":      return t("exports.errors.invalid_language", "This language isn't supported yet.");
        case "tts_pipeline_failed":   return t("exports.errors.audio", "The narrator is resting — please try again in a moment.");
        case "pdf_pipeline_failed":   return t("exports.errors.pdf", "We couldn't build the picture book — please try again.");
        case "storage_upload_failed":
        case "sign_url_failed":
        case "db_insert_failed":      return t("exports.errors.server", "Sorry, something went wrong. Please try again.");
        default:                      return t("exports.errors.generic", "Oops! Please try again.");
      }
    },
    [t],
  );
}

/**
 * Trigger a browser download for the given signed URL. Uses a pre-opened
 * window when available so Safari treats the navigation as a user gesture.
 */
function triggerDownload(win: Window | null, url: string, fileName: string): void {
  if (win) {
    try { win.location.href = url; return; } catch { /* fall through */ }
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function useN8nExport() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>(INITIAL);
  const friendly = useFriendlyError();
  const pendingWindow = useRef<Window | null>(null);

  /** Pre-open a target window synchronously inside the click event. */
  const prepareDownloadWindow = useCallback(() => {
    try {
      pendingWindow.current = window.open("", "_blank");
    } catch {
      pendingWindow.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    try { pendingWindow.current?.close(); } catch { /* ignore */ }
    pendingWindow.current = null;
    setState(INITIAL);
  }, []);

  /**
   * Generic runner used by TXT / MP3 / PDF actions.
   * Handles the toast lifecycle, download trigger, audit and error mapping.
   */
  const run = useCallback(
    async <R extends { exportId: string; downloadUrl: string; fileName: string; provider?: string }>(
      kind: ExportKind,
      action: () => Promise<R>,
      opts?: { preparingMsg?: string; readyMsg?: string; readyDesc?: (r: R) => string | undefined },
    ): Promise<R | null> => {
      setState((s) => ({ ...s, status: "preparing", busyKind: kind, error: null, errorCode: null }));
      toast.message(
        opts?.preparingMsg ?? t("exports.preparing", "Preparing your story..."),
        { description: t("exports.preparing_desc", "This usually takes just a few seconds ✨") },
      );

      try {
        const result = await action();
        setState({
          status: "ready", busyKind: null,
          lastResult: result as unknown as State["lastResult"],
          lastKind: kind,
          error: null, errorCode: null,
        });
        triggerDownload(pendingWindow.current, result.downloadUrl, result.fileName);
        pendingWindow.current = null;
        void logExportDownloaded(result.exportId);
        toast.success(opts?.readyMsg ?? t("exports.ready", "Your story is ready!"), {
          description: opts?.readyDesc?.(result) ?? result.fileName,
        });
        return result;
      } catch (err) {
        try { pendingWindow.current?.close(); } catch { /* ignore */ }
        pendingWindow.current = null;
        const code = err instanceof N8nExportError ? err.code : "generic";
        const retryAfter = err instanceof N8nExportError ? err.retryAfter : undefined;
        const message = friendly(code);
        setState({
          status: "error", busyKind: null, lastResult: null, lastKind: kind,
          error: message, errorCode: code, retryAfter,
        });
        toast.error(message);
        console.error(`[useN8nExport:${kind}] failed`, err);
        return null;
      }
    },
    [friendly, t],
  );

  const exportTxt = useCallback(
    (input: ExportTxtInput) => run<ExportTxtResult>("txt", () => exportStoryAsTxt(input)),
    [run],
  );

  const exportAudio = useCallback(
    (input: ExportAudioInput) =>
      run<ExportAudioResult>("mp3", () => exportStoryAsAudio(input), {
        preparingMsg: t("exports.audio_preparing", "Recording your story..."),
        readyMsg: t("exports.audio_ready", "Your audio story is ready!"),
        readyDesc: (r) => r.cacheHit
          ? t("exports.audio_cached", "Loaded instantly from cache")
          : r.durationSeconds ? `${Math.round(r.durationSeconds)}s` : undefined,
      }),
    [run, t],
  );

  const exportPdf = useCallback(
    (input: ExportPdfInput) =>
      run<ExportPdfResult>("pdf", () => exportStoryAsPdf(input), {
        preparingMsg: t("exports.pdf_preparing", "Drawing your picture book..."),
        readyMsg: t("exports.pdf_ready", "Your picture book is ready!"),
        readyDesc: (r) => r.pageCount ? t("exports.pdf_pages", "{{count}} pages", { count: r.pageCount }) : undefined,
      }),
    [run, t],
  );

  return {
    ...state,
    exportTxt,
    exportAudio,
    exportPdf,
    prepareDownloadWindow,
    reset,
    isBusy: state.status === "preparing",
    isBusyKind: (k: ExportKind) => state.busyKind === k,
  };
}
