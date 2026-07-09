// ============================================================================
// useN8nExport — React hook that drives the n8n export flow with rich UI state.
// ----------------------------------------------------------------------------
// Exposes stateful `status`, `error`, and a `result` handle plus an
// `exportTxt(payload)` action. Handles loading indicators, kid-friendly error
// messages (translated), auto-download in a same-tab window (avoids popup
// blockers) and audit logging.
// ============================================================================

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  exportStoryAsTxt,
  logExportDownloaded,
  N8nExportError,
  type ExportTxtInput,
  type ExportTxtResult,
} from "@/lib/n8nExportApi";

export type ExportStatus = "idle" | "preparing" | "ready" | "error";

interface UseN8nExportState {
  status: ExportStatus;
  result: ExportTxtResult | null;
  error: string | null;
  errorCode: string | null;
  retryAfter?: number;
}

const INITIAL: UseN8nExportState = {
  status: "idle",
  result: null,
  error: null,
  errorCode: null,
};

/**
 * Map a raw error code to a translated, child-friendly message.
 */
function useFriendlyError() {
  const { t } = useTranslation();
  return useCallback(
    (code: string): string => {
      switch (code) {
        case "empty_text":
          return t("exports.errors.empty_text", "There's nothing to export yet.");
        case "text_too_long":
          return t("exports.errors.text_too_long", "The story is a bit too long — please shorten it.");
        case "unauthorized":
          return t("exports.errors.unauthorized", "Please sign in to download your story.");
        case "rate_limited":
        case "blocked":
          return t("exports.errors.rate_limited", "You've made too many exports. Try again soon.");
        case "invalid_language":
          return t("exports.errors.invalid_language", "This language isn't supported yet.");
        case "storage_upload_failed":
        case "sign_url_failed":
        case "db_insert_failed":
          return t("exports.errors.server", "Sorry, something went wrong. Please try again.");
        default:
          return t("exports.errors.generic", "Oops! Please try again.");
      }
    },
    [t],
  );
}

export function useN8nExport() {
  const { t } = useTranslation();
  const [state, setState] = useState<UseN8nExportState>(INITIAL);
  const friendly = useFriendlyError();
  // Pre-open a same-tab window synchronously on the click event so mobile
  // browsers don't strip the download for lacking a user gesture.
  const pendingWindow = useRef<Window | null>(null);

  const reset = useCallback(() => {
    pendingWindow.current?.close();
    pendingWindow.current = null;
    setState(INITIAL);
  }, []);

  /**
   * Prepare a same-tab download target — call this INSIDE the click handler,
   * before any await, so Safari treats the subsequent navigation as a user
   * gesture.
   */
  const prepareDownloadWindow = useCallback(() => {
    try {
      pendingWindow.current = window.open("", "_blank");
    } catch {
      pendingWindow.current = null;
    }
  }, []);

  const exportTxt = useCallback(
    async (input: ExportTxtInput): Promise<ExportTxtResult | null> => {
      setState({ status: "preparing", result: null, error: null, errorCode: null });
      toast.message(
        t("exports.preparing", "Preparing your story..."),
        { description: t("exports.preparing_desc", "This usually takes just a few seconds ✨") },
      );

      try {
        const result = await exportStoryAsTxt(input);
        setState({ status: "ready", result, error: null, errorCode: null });

        // Trigger the download in the pre-opened window when available.
        if (pendingWindow.current) {
          try {
            pendingWindow.current.location.href = result.downloadUrl;
          } catch {
            /* ignore navigation errors */
          }
          pendingWindow.current = null;
        } else {
          // Fallback: create an anchor element.
          const a = document.createElement("a");
          a.href = result.downloadUrl;
          a.download = result.fileName;
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        void logExportDownloaded(result.exportId);
        toast.success(t("exports.ready", "Your story is ready!"), {
          description: result.fileName,
        });
        return result;
      } catch (err) {
        pendingWindow.current?.close();
        pendingWindow.current = null;
        const code = err instanceof N8nExportError ? err.code : "generic";
        const message = friendly(code);
        const retryAfter = err instanceof N8nExportError ? err.retryAfter : undefined;
        setState({
          status: "error",
          result: null,
          error: message,
          errorCode: code,
          retryAfter,
        });
        toast.error(message);
        console.error("[useN8nExport] failed", err);
        return null;
      }
    },
    [friendly, t],
  );

  return {
    ...state,
    exportTxt,
    prepareDownloadWindow,
    reset,
    isBusy: state.status === "preparing",
  };
}
