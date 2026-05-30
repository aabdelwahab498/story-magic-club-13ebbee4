/**
 * Verifies the client-side `recordIllustrationMetric` helper:
 *
 *  1. Dispatches a `CustomEvent("illustration:metric", { detail })` on
 *     `window` for every recorded event.
 *  2. The payload always carries `storyId`, and the optional `idempotencyKey`
 *     when provided.
 *  3. The `event` field values are restricted to the SAME lifecycle names
 *     that the server emits via `logLifecycle` in
 *     `supabase/functions/illustrate-story/index.ts`. If these drift apart
 *     the dashboard / log correlation breaks — this test is the contract.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  recordIllustrationMetric,
  type IllustrationMetric,
  type IllustrationMetricEvent,
} from "@/lib/illustrationMetrics";

// Keep in lockstep with the `logLifecycle` calls in the edge function.
const SERVER_EVENT_NAMES = [
  "queued",
  "complete",
  "failed",
  "idempotent_replay",
  "idempotent_join",
] as const;

const ALL_CLIENT_EVENTS: IllustrationMetricEvent[] = [
  "queued",
  "generating",
  "complete",
  "failed",
  "idempotent_replay",
  "trigger_rejected",
];

describe("illustrationMetrics — CustomEvent payload", () => {
  let received: IllustrationMetric[] = [];
  const handler = (e: Event) => {
    received.push((e as CustomEvent<IllustrationMetric>).detail);
  };

  beforeEach(() => {
    received = [];
    window.addEventListener("illustration:metric", handler as EventListener);
  });
  afterEach(() => {
    window.removeEventListener("illustration:metric", handler as EventListener);
  });

  it("dispatches a CustomEvent for each recorded metric", () => {
    recordIllustrationMetric({
      event: "queued",
      storyId: "story-1",
      idempotencyKey: "story-1:1-2:1700",
    });
    expect(received).toHaveLength(1);
    expect(received[0].event).toBe("queued");
    expect(received[0].storyId).toBe("story-1");
    expect(received[0].idempotencyKey).toBe("story-1:1-2:1700");
    // `ts` is auto-filled if missing.
    expect(received[0].ts).toEqual(expect.any(Number));
  });

  it("always includes storyId and forwards idempotencyKey when present", () => {
    recordIllustrationMetric({
      event: "generating",
      storyId: "story-xyz",
      idempotencyKey: "idem-abc",
    });
    recordIllustrationMetric({
      event: "complete",
      storyId: "story-xyz",
      idempotencyKey: "idem-abc",
      pageIndex: 2,
      latencyMs: 1234,
    });
    expect(received.map((r) => r.storyId)).toEqual(["story-xyz", "story-xyz"]);
    expect(received.map((r) => r.idempotencyKey)).toEqual(["idem-abc", "idem-abc"]);
    expect(received[1].pageIndex).toBe(2);
    expect(received[1].latencyMs).toBe(1234);
  });

  it("omits idempotencyKey field cleanly when not provided", () => {
    recordIllustrationMetric({ event: "queued", storyId: "story-no-key" });
    expect(received[0].storyId).toBe("story-no-key");
    expect(received[0].idempotencyKey).toBeUndefined();
  });

  it("covers every event name that the server logLifecycle emits", () => {
    // Smoke-fire each client-known event and assert it round-trips
    // through the CustomEvent unchanged. This is what makes the test
    // a *contract* between client metrics and server logs.
    for (const ev of ALL_CLIENT_EVENTS) {
      recordIllustrationMetric({ event: ev, storyId: "s", idempotencyKey: "k" });
    }
    expect(received.map((r) => r.event)).toEqual(ALL_CLIENT_EVENTS);

    // Every name the server emits MUST be recognised by the client type.
    for (const serverName of SERVER_EVENT_NAMES) {
      expect(ALL_CLIENT_EVENTS).toContain(serverName as IllustrationMetricEvent);
    }
  });
});
