// TTS pipeline tests — chunking, retries, deterministic cache keys, and
// error mapping. Imports the pure-logic module used by the Supabase edge
// function so we cover the same code paths that run in production.

import { describe, it, expect, vi } from "vitest";
import {
  chunkText,
  computeCacheKey,
  withRetry,
  detectLanguage,
  mapErrorToUserMessage,
  concatMp3,
} from "../../supabase/functions/_shared/tts/logic";
import { TtsError } from "../../supabase/functions/_shared/tts/types";

describe("chunkText", () => {
  it("returns [] for empty/whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n  ")).toEqual([]);
  });

  it("returns a single chunk when under the limit", () => {
    const t = "Hello world. This is short.";
    expect(chunkText(t, 200)).toEqual([t]);
  });

  it("splits on sentence boundaries and stays within maxLen", () => {
    const sentence = "This is a sentence about a small brown fox. ";
    const long = sentence.repeat(20);
    const chunks = chunkText(long, 120);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(120);
  });

  it("hard-splits sentences that exceed maxLen with no punctuation", () => {
    const monster = "x".repeat(5000);
    const chunks = chunkText(monster, 1000);
    expect(chunks.length).toBe(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
  });

  it("handles Arabic sentence terminator ؟", () => {
    const ar = "مرحبا بك. كيف حالك؟ نعم أنا بخير. شكرا.";
    const chunks = chunkText(ar, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(20);
  });
});

describe("computeCacheKey", () => {
  it("is deterministic for identical inputs", async () => {
    const a = await computeCacheKey({ text: "hello", voice: "v1", language: "en", provider: "edge-tts" });
    const b = await computeCacheKey({ text: "hello", voice: "v1", language: "en", provider: "edge-tts" });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is invariant to leading/trailing whitespace and voice casing", async () => {
    const a = await computeCacheKey({ text: "hi there", voice: "V1", language: "EN" });
    const b = await computeCacheKey({ text: "  hi   there  ", voice: "v1", language: "en" });
    expect(a).toBe(b);
  });

  it("changes when voice, language, text, or provider changes", async () => {
    const base = { text: "hi", voice: "v1", language: "en", provider: "edge-tts" };
    const k = await computeCacheKey(base);
    expect(await computeCacheKey({ ...base, text: "hi!" })).not.toBe(k);
    expect(await computeCacheKey({ ...base, voice: "v2" })).not.toBe(k);
    expect(await computeCacheKey({ ...base, language: "ar" })).not.toBe(k);
    expect(await computeCacheKey({ ...base, provider: "openai-tts" })).not.toBe(k);
  });
});

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const out = await withRetry(fn, { attempts: 3, baseDelayMs: 1 });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient failure and eventually resolves", async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue("ok");
    const onAttempt = vi.fn();
    const out = await withRetry(fn, { attempts: 3, baseDelayMs: 1, onAttempt });
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });

  it("throws TtsError after exhausting attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("nope"));
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toBeInstanceOf(TtsError);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-retryable TtsError", async () => {
    const err = new TtsError("invalid_input", "bad", undefined, { retryable: false });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { attempts: 5, baseDelayMs: 1 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("respects an already-aborted signal", async () => {
    const ctl = new AbortController();
    ctl.abort();
    const fn = vi.fn().mockResolvedValue("ok");
    await expect(
      withRetry(fn, { attempts: 3, baseDelayMs: 1, signal: ctl.signal }),
    ).rejects.toBeInstanceOf(TtsError);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("detectLanguage", () => {
  it("returns hint when explicit", () => {
    expect(detectLanguage("hello", "ar-EG")).toBe("ar");
    expect(detectLanguage("مرحبا", "en-US")).toBe("en");
  });
  it("detects Arabic by script density", () => {
    expect(detectLanguage("مرحبا بك في العالم")).toBe("ar");
    expect(detectLanguage("Hello world!")).toBe("en");
  });
});

describe("mapErrorToUserMessage", () => {
  it("maps every known code to a non-empty message", () => {
    for (const code of [
      "invalid_input",
      "text_too_long",
      "unauthorized",
      "tts_upstream_failed",
      "tts_timeout",
      "storage_upload_failed",
      "internal_error",
    ] as const) {
      const msg = mapErrorToUserMessage(code);
      expect(msg).toBeTruthy();
      expect(msg.toLowerCase()).not.toContain("undefined");
    }
  });
});

describe("TtsError", () => {
  it("marks known upstream/storage/timeout codes as retryable by default", () => {
    expect(new TtsError("tts_upstream_failed", "x").retryable).toBe(true);
    expect(new TtsError("tts_timeout", "x").retryable).toBe(true);
    expect(new TtsError("storage_upload_failed", "x").retryable).toBe(true);
  });
  it("marks input/auth errors as non-retryable", () => {
    expect(new TtsError("invalid_input", "x").retryable).toBe(false);
    expect(new TtsError("unauthorized", "x").retryable).toBe(false);
  });
});

describe("concatMp3", () => {
  it("concatenates byte streams in order", () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([4, 5]);
    const c = new Uint8Array([6]);
    const out = concatMp3([a, b, c]);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
