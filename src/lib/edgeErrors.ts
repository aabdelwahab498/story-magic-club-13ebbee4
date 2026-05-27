/**
 * Centralized handling for Supabase edge-function error responses.
 *
 * Translates 429 (rate limit), 422 (moderation rejection),
 * 402 (payment / AI credits), 403 (quota / forbidden) into user-friendly
 * toasts with i18n + retry-after countdowns.
 *
 * Usage:
 *   const { data, error } = await supabase.functions.invoke("generate-story", { body });
 *   if (error) { await handleEdgeError(error, t); return; }
 */
import type { TFunction } from "i18next";
import { toast } from "sonner";

export interface EdgeErrorInfo {
  status: number;
  code?: string;
  message?: string;
  retryAfterSec?: number;
  /** Moderation: which categories were flagged */
  categories?: string[];
  /** Moderation: severity bucket */
  severity?: string;
  /** Request ID surfaced from the edge function for debugging */
  requestId?: string;
  /** Friendly reason from server (e.g. ai_provider_quota, limit_reached) */
  reason?: string;
  raw?: unknown;
}

interface ErrorWithContext {
  context?: Response | { status?: number; statusText?: string };
  status?: number;
  message?: string;
}

/** Try to extract a Response from FunctionsHttpError-style errors. */
async function extractInfo(err: unknown): Promise<EdgeErrorInfo> {
  const e = err as ErrorWithContext;
  const ctx = e?.context;
  let status = 0;
  let body: any = null;
  let retryAfterHeader: string | null = null;

  if (ctx instanceof Response) {
    status = ctx.status;
    retryAfterHeader = ctx.headers.get("retry-after");
    try {
      body = await ctx.clone().json();
    } catch {
      try {
        body = await ctx.clone().text();
      } catch {
        body = null;
      }
    }
  } else if (ctx && typeof ctx === "object") {
    status = (ctx as { status?: number }).status ?? 0;
  }

  if (!status && typeof e?.status === "number") status = e.status;

  const retryAfterSec =
    (typeof body?.retryAfter === "number" && body.retryAfter) ||
    (retryAfterHeader ? Number(retryAfterHeader) : undefined) ||
    undefined;

  return {
    status,
    code: typeof body?.error === "string" ? body.error : typeof body?.code === "string" ? body.code : undefined,
    message: typeof body?.message === "string" ? body.message : e?.message,
    retryAfterSec: Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
    categories: Array.isArray(body?.categories) ? body.categories : undefined,
    severity: typeof body?.severity === "string" ? body.severity : undefined,
    requestId: typeof body?.requestId === "string" ? body.requestId : undefined,
    reason: typeof body?.reason === "string" ? body.reason : undefined,
    raw: body,
  };
}

function fmtCountdown(sec: number): string {
  if (sec < 60) return `${Math.max(1, Math.ceil(sec))}s`;
  const m = Math.ceil(sec / 60);
  return `${m}m`;
}

/** Inspect an edge-function error and show an appropriate toast. */
export async function handleEdgeError(
  err: unknown,
  t: TFunction,
  opts: { context?: string } = {},
): Promise<EdgeErrorInfo> {
  const info = await extractInfo(err);
  const toastId = opts.context ? `edge-${opts.context}` : undefined;

  switch (info.status) {
    case 429: {
      const wait = info.retryAfterSec
        ? t("ai.errors.rate_limited_retry", {
            time: fmtCountdown(info.retryAfterSec),
            defaultValue: `Too many requests. Try again in ${fmtCountdown(info.retryAfterSec)}.`,
          })
        : t("ai.errors.rate_limited");
      toast.error(wait, { id: toastId, duration: 6000 });
      break;
    }
    case 422: {
      // Moderation rejection (NSFW / prompt injection / unsafe content)
      if (info.code === "content_rejected" || info.severity) {
        toast.error(
          t("ai.errors.content_rejected", {
            defaultValue:
              "Your input was flagged as unsafe for children. Please rephrase and try again.",
          }),
          { id: toastId, duration: 7000 },
        );
      } else {
        toast.error(info.message || t("ai.errors.generic"), { id: toastId });
      }
      break;
    }
    case 402: {
      const code = info.code ?? "";
      const reason = info.reason ?? "";
      if (code === "ai_credits_exhausted" || reason === "ai_provider_quota") {
        toast.error(
          t("ai.errors.ai_credits_exhausted", {
            defaultValue: "AI service is temporarily out of credits. Try the free Listen feature or contact support.",
          }),
          { id: toastId, duration: 8000 },
        );
      } else if (code.includes("quota") || reason === "limit_reached") {
        toast.error(
          t("ai.errors.quota_reached", {
            defaultValue: "You've reached your monthly limit. Upgrade to keep creating.",
          }),
          { id: toastId, duration: 7000 },
        );
      } else if (reason === "feature_not_in_plan" || code.includes("subscription")) {
        toast.error(
          t("ai.errors.feature_locked", {
            defaultValue: "This feature requires a paid plan.",
          }),
          { id: toastId, duration: 6000 },
        );
      } else {
        toast.error(t("ai.errors.payment"), { id: toastId });
      }
      break;
    }
    case 403: {
      // Quota / paid feature gate
      const code = info.code ?? "";
      if (code.includes("quota") || code.includes("monthly")) {
        toast.error(
          t("ai.errors.quota_reached", {
            defaultValue: "You've reached your monthly limit. Upgrade to keep creating.",
          }),
          { id: toastId, duration: 7000 },
        );
      } else if (code.includes("paid") || code.includes("feature")) {
        toast.error(
          t("ai.errors.feature_locked", {
            defaultValue: "This feature requires a paid plan.",
          }),
          { id: toastId, duration: 6000 },
        );
      } else {
        toast.error(info.message || t("ai.errors.generic"), { id: toastId });
      }
      break;
    }
    case 413: {
      toast.error(
        t("ai.errors.payload_too_large", {
          defaultValue: "Your input is too long. Please shorten it.",
        }),
        { id: toastId },
      );
      break;
    }
    case 502: {
      toast.error(
        t("ai.errors.ai_invalid_json", {
          defaultValue: "The storyteller returned an incomplete response. Please try again.",
        }),
        { id: toastId, duration: 7000 },
      );
      break;
    }
    case 401: {
      toast.error(
        t("ai.errors.auth_required", {
          defaultValue: "Please sign in to continue.",
        }),
        { id: toastId },
      );
      break;
    }
    default:
      toast.error(t("ai.errors.generic"), { id: toastId });
  }

  if (typeof console !== "undefined") {
    console.warn("[edgeError]", info);
  }
  return info;
}

/** Convenience for fetch() responses (used by streaming endpoints). */
export async function handleEdgeFetchResponse(
  resp: Response,
  t: TFunction,
  opts: { context?: string } = {},
): Promise<EdgeErrorInfo | null> {
  if (resp.ok) return null;
  let body: any = null;
  try {
    body = await resp.clone().json();
  } catch {
    /* ignore */
  }
  const fakeErr = { context: resp, message: body?.message } as unknown;
  return handleEdgeError(fakeErr, t, opts);
}
