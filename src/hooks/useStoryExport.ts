import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  exportStoryAsTxt,
  exportStoryAsAudio,
  exportStoryAsPdf,
  logExportDownloaded,
  StoryExportError,
  type ExportTxtInput,
  type ExportTxtResult,
  type ExportAudioInput,
  type ExportAudioResult,
  type ExportPdfInput,
  type ExportPdfResult,
} from "@/lib/storyExportApi";

export type ExportKind = "txt" | "mp3" | "pdf";
export type ExportStatus = "idle" | "preparing" | "ready" | "error";

export interface KindInfo {
  lastProvider: string | null;
  lastErrorCode: string | null;
  lastError: string | null;
}

const EMPTY_KIND: KindInfo = { lastProvider: null, lastErrorCode: null, lastError: null };

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
  return useCallback((code: string): string => {
    switch (code) {
      case "empty_text": return t("exports.errors.empty_text", "There's nothing to export yet.");
      case "text_too_long": return t("exports.errors.text_too_long", "The story is a bit too long — please shorten it.");
      case "pages_required": return t("exports.errors.pages_required", "This story has no pages yet.");
      case "too_many_pages": return t("exports.errors.too_many_pages", "Please shorten the story to 30 pages or fewer.");
      case "unauthorized": return t("exports.errors.unauthorized", "Please sign in to download your story.");
      case "rate_limited":
      case "blocked": return t("exports.errors.rate_limited", "You've made too many exports. Try again soon.");
      case "invalid_language": return t("exports.errors.invalid_language", "This language isn't supported yet.");
      case "tts_not_configured": return t("exports.errors.tts_not_configured", "Audio export is not configured yet.");
      case "tts_pipeline_failed": return t("exports.errors.audio", "The narrator is resting — please try again in a moment.");
      case "pdf_render_failed":
      case "pdf_font_failed": return t("exports.errors.pdf", "We couldn't build the picture book — please try again.");
      case "storage_upload_failed":
      case "sign_url_failed":
      case "db_insert_failed": return t("exports.errors.server", "Sorry, something went wrong. Please try again.");
      default: return t("exports.errors.generic", "Oops! Please try again.");
    }
  }, [t]);
}

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

export function useStoryExport() {
  const { t } = useTranslation();
  const [state, setState] = useState<State>(INITIAL);
  const friendly = useFriendlyError();
  const pendingWindow = useRef<Window | null>(null);
  const lastRunRef = useRef<(() => Promise<unknown>) | null>(null);

  const prepareDownloadWindow = useCallback(() => {
    try { pendingWindow.current = window.open("", "_blank"); }
    catch { pendingWindow.current = null; }
  }, []);

  const reset = useCallback(() => {
    try { pendingWindow.current?.close(); } catch { /* ignore */ }
    pendingWindow.current = null;
    setState(INITIAL);
  }, []);

  const run = useCallback(async <R extends { exportId: string; downloadUrl: string; fileName: string; provider?: string }>(
    kind: ExportKind,
    action: () => Promise<R>,
    opts?: { preparingMsg?: string; readyMsg?: string; readyDesc?: (r: R) => string | undefined },
  ): Promise<R | null> => {
    lastRunRef.current = () => run(kind, action, opts);
    setState((s) => ({ ...s, status: "preparing", busyKind: kind, error: null, errorCode: null }));
    toast.message(opts?.preparingMsg ?? t("exports.preparing", "Preparing your story..."), {
      description: t("exports.preparing_desc", "This usually takes just a few seconds ✨"),
    });

    try {
      const result = await action();
      const provider = result.provider ?? "local";
      setState((s) => ({
        ...s,
        status: "ready",
        busyKind: null,
        lastResult: result as unknown as State["lastResult"],
        lastKind: kind,
        error: null,
        errorCode: null,
        kinds: { ...s.kinds, [kind]: { lastProvider: provider, lastErrorCode: null, lastError: null } },
      }));
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
      const code = err instanceof StoryExportError ? err.code : "generic";
      const retryAfter = err instanceof StoryExportError ? err.retryAfter : undefined;
      const message = friendly(code);
      setState((s) => ({
        ...s,
        status: "error",
        busyKind: null,
        lastResult: null,
        lastKind: kind,
        error: message,
        errorCode: code,
        retryAfter,
        kinds: { ...s.kinds, [kind]: { ...s.kinds[kind], lastErrorCode: code, lastError: message } },
      }));
      toast.error(message);
      console.error(`[useStoryExport:${kind}] failed`, err);
      return null;
    }
  }, [friendly, t]);

  const retry = useCallback(() => {
    prepareDownloadWindow();
    void lastRunRef.current?.();
  }, [prepareDownloadWindow]);

  const exportTxt = useCallback((input: ExportTxtInput) => run<ExportTxtResult>("txt", () => exportStoryAsTxt(input)), [run]);
  const exportAudio = useCallback((input: ExportAudioInput) => run<ExportAudioResult>("mp3", () => exportStoryAsAudio(input), {
    preparingMsg: t("exports.audio_preparing", "Recording your story..."),
    readyMsg: t("exports.audio_ready", "Your audio story is ready!"),
    readyDesc: (r) => r.cacheHit ? t("exports.audio_cached", "Loaded instantly from cache") : r.durationSeconds ? `${Math.round(r.durationSeconds)}s` : undefined,
  }), [run, t]);
  const exportPdf = useCallback((input: ExportPdfInput) => run<ExportPdfResult>("pdf", () => exportStoryAsPdf(input), {
    preparingMsg: t("exports.pdf_preparing", "Drawing your picture book..."),
    readyMsg: t("exports.pdf_ready", "Your picture book is ready!"),
    readyDesc: (r) => r.pageCount ? t("exports.pdf_pages", "{{count}} pages", { count: r.pageCount }) : undefined,
  }), [run, t]);

  return {
    ...state,
    exportTxt,
    exportAudio,
    exportPdf,
    prepareDownloadWindow,
    reset,
    retry,
    isBusy: state.status === "preparing",
    isBusyKind: (k: ExportKind) => state.busyKind === k,
  };
}