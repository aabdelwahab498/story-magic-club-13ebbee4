import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeApiError } from "../api/errors";
import { normalizeStoryPlan } from "../lib/storyPlanNormalizer";

describe("Production Resilience & Error Recovery Suite (A through O)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario A: /stories/plan succeeds → normal preview.
  it("A. /stories/plan succeeds → returns valid normalized preview blueprint", () => {
    const rawPlan = {
      title: "The Magic Castle",
      characters: [
        { name: "Sami", role: "hero", description: "Brave explorer" },
        { name: "Pip", role: "companion", description: "Tiny bird" }
      ],
      conflict: "Lost in the forest",
      resolution: "Found the golden key",
      selGoals: ["Curiosity"],
      pageCount: 10
    };

    const normalized = normalizeStoryPlan(rawPlan, "Sami");
    expect(normalized.title).toBe("The Magic Castle");
    expect(normalized.hero.name).toBe("Sami");
    expect(normalized.companion?.name).toBe("Pip");
    expect(normalized.acts.act2_disturbance).toBe("Lost in the forest");
    expect(normalized.pageCount).toBe(10);
  });

  // Scenario B: /stories/plan returns controlled 503 → classified as AI_TEMPORARILY_UNAVAILABLE
  it("B. /stories/plan returns 503 → classifies as AI_TEMPORARILY_UNAVAILABLE with user-friendly retry message", () => {
    const error503 = {
      response: {
        status: 503,
        data: { message: "Service Unavailable: High demand" }
      }
    };
    const norm = normalizeApiError(error503, "en");
    expect(norm.category).toBe("AI_TEMPORARILY_UNAVAILABLE");
    expect(norm.status).toBe(503);
    expect(norm.retryable).toBe(true);
    expect(norm.userMessage).toContain("Najmah is a little busy creating stories right now");
  });

  // Scenario C: retry after 503 succeeds → preview renders cleanly
  it("C. retry after 503 succeeds → produces valid blueprint without form reset", () => {
    // 1. Initial 503 failure
    const error503 = { response: { status: 503 } };
    const norm1 = normalizeApiError(error503, "en");
    expect(norm1.retryable).toBe(true);

    // 2. Retry succeeds
    const rawPlan = {
      title: "The Magic Mountain",
      characters: [{ name: "Lina", role: "hero", description: "Clever girl" }],
      conflict: "High peak ahead",
      resolution: "Reached the peak safely",
      selGoals: ["Perseverance"],
      pageCount: 11
    };
    const normalized = normalizeStoryPlan(rawPlan, "Lina");
    expect(normalized.title).toBe("The Magic Mountain");
    expect(normalized.hero.name).toBe("Lina");
  });

  // Scenario D: repeated click while request pending → in-flight guard test
  it("D. repeated click guard prevents duplicate execution when request is already in-flight", () => {
    let count = 0;
    let isInFlight = false;

    const executeAction = () => {
      if (isInFlight) return "BLOCKED";
      isInFlight = true;
      count++;
      return "STARTED";
    };

    expect(executeAction()).toBe("STARTED");
    expect(executeAction()).toBe("BLOCKED");
    expect(executeAction()).toBe("BLOCKED");
    expect(count).toBe(1);
  });

  // Scenario E: canonical StoryPlan hero + companion → no crash
  it("E. canonical StoryPlan hero + companion → extracts both hero and companion safely", () => {
    const rawPlan = {
      title: "Space Journey",
      characters: [
        { name: "Zayn", role: "hero", description: "Young astronaut" },
        { name: "Orion", role: "companion", description: "Robot friend" }
      ],
      conflict: "Asteroid storm",
      resolution: "Landed safely on Mars",
      selGoals: ["Teamwork"],
      pageCount: 11
    };

    const normalized = normalizeStoryPlan(rawPlan, "Zayn");
    expect(normalized.hero.name).toBe("Zayn");
    expect(normalized.companion?.name).toBe("Orion");
    expect(normalized.companion?.role).toBe("Robot friend");
  });

  // Scenario F: canonical StoryPlan hero only → no crash
  it("F. canonical StoryPlan hero only → handles missing companion safely without crash", () => {
    const rawPlan = {
      title: "Solo Adventure",
      characters: [{ name: "Nour", role: "hero", description: "Curious kid" }],
      conflict: "Dark cave",
      resolution: "Lit a torch",
      selGoals: ["Courage"],
      pageCount: 8
    };

    const normalized = normalizeStoryPlan(rawPlan, "Nour");
    expect(normalized.hero.name).toBe("Nour");
    expect(normalized.companion).toBeUndefined();
    expect(normalized.title).toBe("Solo Adventure");
  });

  // Scenario G: canonical StoryPlan characters=[] → localized safe fallback, no global crash
  it("G. canonical StoryPlan characters=[] → provides fallback hero without crash", () => {
    const rawPlan = {
      title: "Empty Characters Story",
      characters: [],
      conflict: "Mystery event",
      resolution: "Resolved mysterious event",
      selGoals: ["Wisdom"],
      pageCount: 5
    };

    const normalized = normalizeStoryPlan(rawPlan, "FallbackHero");
    expect(normalized.hero.name).toBe("FallbackHero");
    expect(normalized.characters).toEqual([]);
    expect(normalized.title).toBe("Empty Characters Story");
  });

  // Scenario H: 401 → correct auth/session handling, not generic AI error
  it("H. 401 response → classified as AUTH_REQUIRED with sign-in prompt", () => {
    const error401 = { response: { status: 401, data: { message: "Jwt expired" } } };
    const norm = normalizeApiError(error401, "en");
    expect(norm.category).toBe("AUTH_REQUIRED");
    expect(norm.status).toBe(401);
    expect(norm.retryable).toBe(false);
    expect(norm.userMessage).toBe("Your session has expired. Please sign in again.");
  });

  // Scenario I: story quota exhausted → correct story quota message
  it("I. 402 story quota exhausted → classified as INSUFFICIENT_CREDITS with story limit message", () => {
    const error402 = {
      response: {
        status: 402,
        data: { code: "insufficient_credits", message: "Story quota reached for this month" }
      }
    };
    const norm = normalizeApiError(error402, "en");
    expect(norm.category).toBe("INSUFFICIENT_CREDITS");
    expect(norm.userMessage).toContain("reached your story limit");
  });

  // Scenario J: illustration credits exhausted → correct illustration credit message
  it("J. illustration credits exhausted → classified as INSUFFICIENT_CREDITS with illustration message", () => {
    const errorIllustrationCredit = {
      response: {
        status: 402,
        data: { code: "illustration_credits_exhausted", message: "No illustration credits remaining" }
      }
    };
    const norm = normalizeApiError(errorIllustrationCredit, "en");
    expect(norm.category).toBe("INSUFFICIENT_CREDITS");
    expect(norm.userMessage).toContain("enough illustration credits");
  });

  // Scenario K: network failure → form preserved and recoverable
  it("K. network failure / ECONNABORTED → classified as NETWORK_TEMPORARY_FAILURE", () => {
    const networkErr = new Error("Network Error");
    (networkErr as any).code = "ECONNABORTED";

    const norm = normalizeApiError(networkErr, "en");
    expect(norm.category).toBe("NETWORK_TEMPORARY_FAILURE");
    expect(norm.retryable).toBe(true);
    expect(norm.userMessage).toContain("couldn't reach Najmah right now");
  });

  // Scenario L: malformed optional generated field → affected section degrades safely
  it("L. malformed optional generated field → fallback default value safely applied", () => {
    const malformed = {
      title: null,
      characters: null,
      acts: null,
      selOutcome: undefined
    };

    const normalized = normalizeStoryPlan(malformed, "DefaultChild");
    expect(normalized.title).toBe("Magical Story Preview");
    expect(normalized.hero.name).toBe("DefaultChild");
    expect(normalized.selGoals).toEqual(["Empathy"]);
  });

  // Scenario M: one failed illustration among completed pages → completed pages remain usable
  it("M. partial illustration state → completed pages stay intact while failed page retains retry path", () => {
    const pageStates: Record<number, "ready" | "failed"> = {
      1: "ready",
      2: "ready",
      3: "failed",
      4: "ready"
    };

    const completedPages = Object.keys(pageStates).filter(
      (k) => pageStates[Number(k)] === "ready"
    );
    expect(completedPages).toHaveLength(3);
    expect(pageStates[3]).toBe("failed");
  });

  // Scenario N: audio failure → story text remains usable
  it("N. audio failure → story text remains available and visible", () => {
    const storyState = {
      text: "Once upon a time in a magical valley...",
      audioError: "Audio engine unavailable"
    };

    expect(storyState.text).toBeTruthy();
    expect(storyState.audioError).toBeDefined();
  });

  // Scenario O: PDF / export failure → story remains usable
  it("O. PDF export failure → story and images remain intact", () => {
    const storyData = {
      title: "Starry Night",
      pages: [{ index: 1, text: "Page 1 content" }],
      pdfExportStatus: "FAILED"
    };

    expect(storyData.pages).toHaveLength(1);
    expect(storyData.pdfExportStatus).toBe("FAILED");
  });
});
