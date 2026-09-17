/**
 * ONE centralized frontend error-normalization boundary.
 *
 * Every request path (Backend Core via axios, Supabase edge functions,
 * ComposeStoryError from the SEL client, raw network failures) is folded into a
 * single stable shape so components never parse provider-specific error objects
 * themselves, and users never see raw JSON, stack traces or internal messages.
 *
 * Canonical backend error codes always win over HTTP-status inference, and
 * billing/credit states are NEVER inferred from unrelated HTTP errors.
 */
import type { TFunction } from "i18next";

export type ApiErrorCategory =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "FORBIDDEN"
  | "ENTITLEMENT_REQUIRED"
  | "INSUFFICIENT_CREDITS"
  | "STORY_QUOTA_EXCEEDED"
  | "CONFLICT"
  | "TEMPORARILY_RATE_LIMITED"
  | "AI_TEMPORARILY_UNAVAILABLE"
  | "NETWORK_TEMPORARY_FAILURE"
  | "INTERNAL_ERROR";

export interface NormalizedApiError {
  status: number;
  code?: string;
  category: ApiErrorCategory;
  /** True when the user may safely press "Try again" on the same input. */
  retryable: boolean;
  /** Friendly, localized, user-safe text. Never raw provider output. */
  message: string;
  correlationId?: string;
}

export const AI_PROVIDER_UNAVAILABLE_CODE = "AI_PROVIDER_TEMPORARILY_UNAVAILABLE";

/** Canonical backend codes that carry their own meaning regardless of status. */
const CODE_CATEGORIES: Record<string, ApiErrorCategory> = {
  AI_PROVIDER_TEMPORARILY_UNAVAILABLE: "AI_TEMPORARILY_UNAVAILABLE",
  ai_provider_unavailable: "AI_TEMPORARILY_UNAVAILABLE",
  ai_provider_quota: "INSUFFICIENT_CREDITS",
  ai_credits_exhausted: "INSUFFICIENT_CREDITS",
  insufficient_credits: "INSUFFICIENT_CREDITS",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  illustration_credits_exhausted: "INSUFFICIENT_CREDITS",
  story_limit_reached: "STORY_QUOTA_EXCEEDED",
  limit_reached: "STORY_QUOTA_EXCEEDED",
  monthly_limit_reached: "STORY_QUOTA_EXCEEDED",
  PLAN_LIMIT_REACHED: "STORY_QUOTA_EXCEEDED",
  FEATURE_NOT_ENABLED: "ENTITLEMENT_REQUIRED",
  entitlement_required: "ENTITLEMENT_REQUIRED",
  unauthorized: "SESSION_EXPIRED",
  UNAUTHENTICATED: "SESSION_EXPIRED",
  session_expired: "SESSION_EXPIRED",
  child_required: "VALIDATION_ERROR",
  rate_limited: "TEMPORARILY_RATE_LIMITED",
};

const RETRYABLE: ApiErrorCategory[] = [
  "AI_TEMPORARILY_UNAVAILABLE",
  "NETWORK_TEMPORARY_FAILURE",
  "TEMPORARILY_RATE_LIMITED",
  "INTERNAL_ERROR",
];

const categoryFromStatus = (status: number): ApiErrorCategory => {
  switch (status) {
    case 400:
    case 422:
      return "VALIDATION_ERROR";
    case 401:
      return "SESSION_EXPIRED";
    case 402:
      return "INSUFFICIENT_CREDITS";
    case 403:
      return "FORBIDDEN";
    case 409:
      return "CONFLICT";
    case 429:
      return "TEMPORARILY_RATE_LIMITED";
    case 503:
      return "AI_TEMPORARILY_UNAVAILABLE";
    default:
      return "INTERNAL_ERROR";
  }
};

const isNetworkFailure = (err: Record<string, unknown>): boolean => {
  const code = String(err.code ?? "");
  if (["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK", "ECONNRESET"].includes(code)) return true;
  const msg = String((err.message as string) ?? "").toLowerCase();
  if (/network error|failed to fetch|timed out|timeout|load failed/.test(msg)) return true;
  // Axios error with a config but no response at all = the request never landed.
  return Boolean(err.config) && !err.response && !err.status;
};

/**
 * Friendly, user-safe copy per category. Uses the app's existing i18n resources
 * (English defaults inline, Arabic and the other locales resolve through the
 * same translation keys) — no parallel translation system.
 */
export const friendlyMessageFor = (
  category: ApiErrorCategory,
  t?: TFunction | ((key: string, def?: string) => string),
): string => {
  const tr = (key: string, def: string) => (t ? String((t as (k: string, d?: string) => string)(key, def) ?? def) : def);
  switch (category) {
    case "AI_TEMPORARILY_UNAVAILABLE":
      return tr(
        "errors.ai_temporarily_unavailable",
        "Najmah is a little busy creating stories right now. Your story settings are safe. Please try again shortly.",
      );
    case "NETWORK_TEMPORARY_FAILURE":
      return tr(
        "errors.network_temporary",
        "We couldn't reach Najmah right now. Your story settings are safe. Please check your connection and try again.",
      );
    case "TEMPORARILY_RATE_LIMITED":
      return tr(
        "errors.rate_limited",
        "Too many stories at once. Your story settings are safe. Please wait a moment and try again.",
      );
    case "SESSION_EXPIRED":
    case "AUTH_REQUIRED":
      return tr("errors.session_expired", "Your session has expired. Please sign in again.");
    case "STORY_QUOTA_EXCEEDED":
      return tr("errors.story_quota_exceeded", "You've reached your story limit for the current plan.");
    case "INSUFFICIENT_CREDITS":
      return tr(
        "errors.insufficient_illustration_credits",
        "You don't have enough illustration credits for this action.",
      );
    case "ENTITLEMENT_REQUIRED":
      return tr("errors.entitlement_required", "This feature isn't included in your current plan.");
    case "FORBIDDEN":
      return tr("errors.forbidden", "You don't have permission to do this.");
    case "VALIDATION_ERROR":
      return tr("errors.validation", "Something in the story settings needs a small fix. Please review and try again.");
    case "CONFLICT":
      return tr("errors.conflict", "This action was already in progress. Please refresh and try again.");
    default:
      return tr(
        "errors.internal",
        "Something went wrong on our side. Your story settings are safe. Please try again in a moment.",
      );
  }
};

/**
 * Normalize ANY thrown error into the stable frontend shape.
 * `preferServerMessage` keeps a safe, already-friendly server message (used for
 * validation-style errors the backend words better than we can).
 */
export const normalizeApiError = (
  error: unknown,
  t?: TFunction | ((key: string, def?: string) => string),
): NormalizedApiError => {
  const err = (error ?? {}) as Record<string, any>;
  const data = err.data ?? err.response?.data ?? {};
  const status: number = Number(err.status ?? err.response?.status ?? 0) || 0;

  const rawCode: string | undefined =
    (typeof data?.code === "string" && data.code) ||
    (typeof err.code === "string" && !/^E[A-Z_]+$/.test(err.code) ? err.code : undefined) ||
    undefined;

  let category: ApiErrorCategory | undefined = rawCode ? CODE_CATEGORIES[rawCode] : undefined;

  if (!category && isNetworkFailure(err)) category = "NETWORK_TEMPORARY_FAILURE";
  if (!category && status) category = categoryFromStatus(status);
  if (!category) category = "INTERNAL_ERROR";

  // A friendly, already-localized message from our own SEL client is safe to keep;
  // anything else falls back to the category copy so raw text never leaks.
  const clientFriendly =
    typeof err.friendlyMessage === "string" && err.friendlyMessage.trim() ? err.friendlyMessage : undefined;
  const message =
    category === "VALIDATION_ERROR" && clientFriendly ? clientFriendly : clientFriendly && category === "SESSION_EXPIRED" ? clientFriendly : friendlyMessageFor(category, t);

  const correlationId =
    (typeof data?.trace_id === "string" && data.trace_id) ||
    (typeof data?.requestId === "string" && data.requestId) ||
    (typeof err.requestId === "string" && err.requestId) ||
    undefined;

  const retryable =
    typeof data?.retryable === "boolean" ? data.retryable || RETRYABLE.includes(category) : RETRYABLE.includes(category);

  return { status, code: rawCode, category, retryable, message, correlationId };
};

/** True for the controlled, retryable "AI provider temporarily unavailable" contract. */
export const isProviderTemporarilyUnavailable = (error: unknown): boolean =>
  normalizeApiError(error).category === "AI_TEMPORARILY_UNAVAILABLE";

/** True when the user must sign in again. */
export const isSessionExpired = (error: unknown): boolean => {
  const n = normalizeApiError(error);
  return n.category === "SESSION_EXPIRED" || n.category === "AUTH_REQUIRED";
};
