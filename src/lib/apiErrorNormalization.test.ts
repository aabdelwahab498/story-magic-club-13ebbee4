/**
 * Central error-normalization contract: every backend / network failure becomes
 * one predictable, user-safe shape. No component parses raw errors.
 */
import { describe, it, expect } from "vitest";
import { ApiError } from "@/api/errors";
import { normalizeApiError, isSessionExpired, isProviderTemporarilyUnavailable } from "./apiErrorNormalization";

const api = (status: number, message: string, data?: unknown) => new ApiError(status, message, data);

describe("normalizeApiError — status mapping", () => {
  it("maps validation, auth, entitlement, credits, conflict and rate limiting", () => {
    expect(normalizeApiError(api(400, "bad")).category).toBe("VALIDATION_ERROR");
    expect(normalizeApiError(api(422, "bad")).category).toBe("VALIDATION_ERROR");
    expect(normalizeApiError(api(401, "no")).category).toBe("SESSION_EXPIRED");
    expect(normalizeApiError(api(402, "pay")).category).toBe("INSUFFICIENT_CREDITS");
    expect(normalizeApiError(api(403, "nope")).category).toBe("FORBIDDEN");
    expect(normalizeApiError(api(409, "dup")).category).toBe("CONFLICT");
    expect(normalizeApiError(api(429, "slow")).category).toBe("TEMPORARILY_RATE_LIMITED");
    expect(normalizeApiError(api(500, "Internal server error")).category).toBe("INTERNAL_ERROR");
  });

  it("maps the canonical provider-outage contract to a retryable AI category", () => {
    const n = normalizeApiError(
      api(503, "busy", {
        code: "AI_PROVIDER_TEMPORARILY_UNAVAILABLE",
        retryable: true,
        trace_id: "trace-9",
      }),
    );
    expect(n.category).toBe("AI_TEMPORARILY_UNAVAILABLE");
    expect(n.retryable).toBe(true);
    expect(n.correlationId).toBe("trace-9");
    expect(isProviderTemporarilyUnavailable(api(503, "busy"))).toBe(true);
  });

  it("uses canonical backend codes over the raw status", () => {
    expect(normalizeApiError(api(403, "x", { code: "story_limit_reached" })).category).toBe(
      "STORY_QUOTA_EXCEEDED",
    );
    expect(
      normalizeApiError(api(402, "x", { code: "illustration_credits_exhausted" })).category,
    ).toBe("INSUFFICIENT_CREDITS");
    expect(normalizeApiError(api(403, "x", { code: "entitlement_required" })).category).toBe(
      "ENTITLEMENT_REQUIRED",
    );
  });

  it("classifies network failures as temporary, not as billing problems", () => {
    const n = normalizeApiError(Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }));
    expect(n.category).toBe("NETWORK_TEMPORARY_FAILURE");
    expect(n.retryable).toBe(true);
    expect(normalizeApiError(new TypeError("Failed to fetch")).category).toBe(
      "NETWORK_TEMPORARY_FAILURE",
    );
  });

  it("never surfaces raw technical text to users", () => {
    for (const e of [
      api(500, "Internal server error"),
      api(503, "AxiosError: Request failed with status code 503"),
      new TypeError("Cannot read properties of undefined (reading 'name')"),
    ]) {
      const m = normalizeApiError(e).message;
      expect(m).not.toMatch(/Internal server error|AxiosError|TypeError|undefined/i);
      expect(m.length).toBeGreaterThan(0);
    }
  });

  it("recognises expired sessions distinctly from generation failures", () => {
    expect(isSessionExpired(api(401, "no"))).toBe(true);
    expect(isSessionExpired(api(503, "busy"))).toBe(false);
  });

  it("marks only temporary categories as retryable", () => {
    expect(normalizeApiError(api(429, "slow")).retryable).toBe(true);
    expect(normalizeApiError(api(400, "bad")).retryable).toBe(false);
    expect(normalizeApiError(api(403, "nope")).retryable).toBe(false);
  });
});
