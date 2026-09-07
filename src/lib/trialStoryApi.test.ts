import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateTrialStory,
  TrialRateLimitedError,
  TrialContentRejectedError,
  TrialServerError,
  type TrialInput,
} from "./trialStoryApi";

const NAJMAH_URL = "https://najmah-api.nextnext-gen.com/api/v2/stories/trial";

const baseInput: TrialInput = {
  childName: "Sara",
  age: 6,
  theme: "space adventure",
  language: "en",
  customPrompt: "learn to share",
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("generateTrialStory (NestJS runtime)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to the Najmah API with JSON content type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "r1", teaser: true, title: "T", pages: [], totalPages: 3, shownPages: 3,
    }));

    await generateTrialStory(baseInput);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(NAJMAH_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("maps customPrompt to selGoal and sends only DTO fields (no fingerprint)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "r1", teaser: true, title: "T", pages: [], totalPages: 3, shownPages: 3,
    }));

    await generateTrialStory(baseInput);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      childName: "Sara",
      age: 6,
      theme: "space adventure",
      language: "en",
      selGoal: "learn to share",
    });
    expect(body.fingerprint).toBeUndefined();
    expect(body.customPrompt).toBeUndefined();
  });

  it("omits optional language/selGoal when absent", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      requestId: "r1", teaser: true, title: "T", pages: [], totalPages: 3, shownPages: 3,
    }));

    await generateTrialStory({ childName: "Omar", age: 5, theme: "ocean" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ childName: "Omar", age: 5, theme: "ocean" });
  });

  it("parses a successful response", async () => {
    const payload = {
      requestId: "req-9",
      teaser: true,
      title: "The Brave Star",
      pages: [{ index: 0, text: "Once...", emotionTag: "joy", illustrationPrompt: "p", imageUrl: null }],
      totalPages: 3,
      shownPages: 1,
      sel_outcome: { skill: "empathy", emotion: "joy", statement: "I can share." },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));

    const result = await generateTrialStory(baseInput);
    expect(result.title).toBe("The Brave Star");
    expect(result.pages).toHaveLength(1);
    expect(result.sel_outcome?.skill).toBe("empathy");
  });

  it("maps 429 to TrialRateLimitedError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, {
      success: false, statusCode: 429, error: "rate_limited", message: "slow down", retry_after: 42,
    }));

    const err = await generateTrialStory(baseInput).catch((e) => e);
    expect(err).toBeInstanceOf(TrialRateLimitedError);
    expect(err.retryAfter).toBe(42);
    expect(err.reason).toBe("rate_limited");
  });

  it("maps content rejection to TrialContentRejectedError", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, {
      success: false, statusCode: 400, code: "content_rejected", message: "Not suitable for kids.",
    }));

    const err = await generateTrialStory(baseInput).catch((e) => e);
    expect(err).toBeInstanceOf(TrialContentRejectedError);
    expect(err.userMessage).toBe("Not suitable for kids.");
  });

  it("maps other 4xx/5xx to TrialServerError with requestId/trace_id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {
      success: false, statusCode: 500, error: "internal_error", message: "boom", trace_id: "trace-123",
    }));

    const err = await generateTrialStory(baseInput).catch((e) => e);
    expect(err).toBeInstanceOf(TrialServerError);
    expect(err.status).toBe(500);
    expect(err.userMessage).toBe("boom");
    expect(err.requestId).toBe("trace-123");
  });

  it("maps network failure to TrialServerError", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));

    const err = await generateTrialStory(baseInput).catch((e) => e);
    expect(err).toBeInstanceOf(TrialServerError);
  });
});
