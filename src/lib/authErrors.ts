import type { TFunction } from "i18next";

/**
 * Map Supabase auth errors to user-friendly, contextual messages.
 * `context` lets us tailor copy (e.g. "forgot", "resend", "reset", "signin").
 */
export const describeAuthError = (
  err: { message?: string; status?: number; name?: string } | null | undefined,
  t: TFunction,
  context: "forgot" | "resend" | "reset" | "signin" | "signup" = "signin"
): string => {
  const raw = (err?.message || "").toLowerCase();
  const status = err?.status ?? 0;

  // Rate-limit from Supabase
  if (status === 429 || raw.includes("rate") || raw.includes("too many")) {
    return t(
      "auth_errors.rate_limited",
      "Too many attempts. Please wait a minute and try again."
    );
  }

  // Network / offline
  if (!err?.message || raw.includes("failed to fetch") || raw.includes("network")) {
    return t(
      "auth_errors.network",
      "Network problem — check your connection and try again."
    );
  }

  if (raw.includes("invalid login") || raw.includes("invalid credentials")) {
    return t("auth_errors.bad_credentials", "Wrong email or password.");
  }

  if (raw.includes("email not confirmed")) {
    return t(
      "auth_errors.email_not_confirmed",
      "Your email is not confirmed yet. Open the link we sent you, or request a new one."
    );
  }

  if (raw.includes("user already registered") || raw.includes("already been registered")) {
    return t(
      "auth_errors.already_registered",
      "An account with this email already exists. Try signing in or resetting your password."
    );
  }

  if (raw.includes("token") && (raw.includes("expired") || raw.includes("invalid"))) {
    if (context === "reset") {
      return t(
        "auth_errors.reset_link_expired",
        "This reset link has expired or was already used. Request a new one."
      );
    }
    return t(
      "auth_errors.link_expired",
      "This link is no longer valid. Request a new one."
    );
  }

  if (raw.includes("password") && raw.includes("short")) {
    return t(
      "auth_errors.password_short",
      "Password is too short. Use at least 8 characters."
    );
  }

  if (raw.includes("password") && raw.includes("pwned")) {
    return t(
      "auth_errors.password_leaked",
      "This password appears in a known data breach — please choose a different one."
    );
  }

  if (raw.includes("user not found")) {
    if (context === "forgot") {
      // Don't leak account existence; show the same success-style message.
      return t(
        "auth_errors.forgot_unknown",
        "If an account exists for this email, a reset link is on its way."
      );
    }
    return t("auth_errors.user_not_found", "No account found for this email.");
  }

  if (raw.includes("smtp") || raw.includes("send email") || raw.includes("email") && raw.includes("failed")) {
    return t(
      "auth_errors.email_send_failed",
      "We couldn't send the email right now. Please try again in a moment."
    );
  }

  // Fallback: surface the raw message but prefixed so it's clearly an error.
  return t("auth_errors.generic", "Something went wrong: {{msg}}", {
    msg: err?.message ?? "unknown error",
  });
};
