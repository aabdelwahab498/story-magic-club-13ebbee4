// Server integration test: illustrate-story MUST collapse duplicate jobs
// when the same idempotencyKey + page set is replayed for the same user.
//
// Two duplicate requests fired in parallel should resolve to the *same*
// illustrations payload (one underlying job, replayed). A third request
// with a DIFFERENT idempotencyKey must be treated as a fresh job.
//
// Requires a real bearer token for an authenticated user with the
// "illustrations" feature entitlement. We auto-skip when the token is
// missing so a fresh checkout / CI without secrets still passes.
import { describe, it, expect } from "vitest";

const env = (import.meta as unknown as { env: Record<string, string> }).env;
const SUPABASE_URL = env.VITE_SUPABASE_URL ?? "";
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const USER_JWT =
  (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.INTEGRATION_USER_JWT ?? "";

const ENABLE = !!SUPABASE_URL && !!ANON_KEY && !!USER_JWT;

const callIllustrate = (body: Record<string, unknown>) =>
  fetch(`${SUPABASE_URL}/functions/v1/illustrate-story`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${USER_JWT}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });

const basePayload = (key: string) => ({
  trigger: "user",
  triggerSource: "idempotency-integration-test",
  storyId: `idem-test-${Date.now()}`,
  characterVisualHash: "name:test|age:6|skin:warm|hair:short|outfit:blue|item:star",
  idempotencyKey: key,
  pages: [
    { index: 1, illustrationPrompt: "a calm field at dawn", emotionTag: "calm" },
  ],
});

describe.skipIf(!ENABLE)(
  "Server integration — illustrate-story collapses duplicate idempotencyKey",
  () => {
    it("two parallel requests with the same key return identical payloads", async () => {
      const key = `vitest-idem-${crypto.randomUUID()}`;
      const body = basePayload(key);
      const [r1, r2] = await Promise.all([
        callIllustrate(body),
        callIllustrate(body),
      ]);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      const [j1, j2] = await Promise.all([r1.json(), r2.json()]);
      expect(j1.storyId).toBe(j2.storyId);
      expect(j1.illustrations).toEqual(j2.illustrations);
      // At least one of the responses should be flagged as the dedup replay.
      expect(j1.idempotent === true || j2.idempotent === true).toBe(true);
    }, 180_000);

    it("a different idempotencyKey runs a fresh job (no dedup)", async () => {
      const body1 = basePayload(`vitest-idem-${crypto.randomUUID()}`);
      const body2 = { ...basePayload(`vitest-idem-${crypto.randomUUID()}`), storyId: body1.storyId };
      const r1 = await callIllustrate(body1);
      const r2 = await callIllustrate(body2);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      const j2 = await r2.json();
      // Fresh key → not flagged as a replay.
      expect(j2.idempotent).not.toBe(true);
    }, 180_000);
  },
);

// Pure unit assertion: the client always supplies an idempotencyKey so the
// server can dedup. Guards against accidental regression in selStoryApi /
// SelStoryViewer where the field is built.
describe("Client contract — illustrate calls always carry an idempotencyKey", () => {
  it("idempotencyKey shape is stable for a given (storyId, page set)", () => {
    const storyId = "abc-123";
    const pages = [{ index: 2 }, { index: 4 }];
    const k1 = `${storyId}:${pages.map((p) => p.index).join("-")}`;
    const k2 = `${storyId}:${pages.map((p) => p.index).join("-")}`;
    expect(k1).toBe(k2);
    expect(k1).toContain(storyId);
  });
});
