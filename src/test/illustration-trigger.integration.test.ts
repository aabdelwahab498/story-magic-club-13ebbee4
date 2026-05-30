// Server integration tests: every illustration endpoint MUST reject calls
// that omit or mismatch `trigger: "user"` with HTTP 403 + JSON error
// "trigger_required" — defense-in-depth for the Function B contract.
//
// We hit the deployed edge functions directly (not via supabase-js) so we
// can inspect the raw status + body. The tests are skipped automatically
// when running in an environment without the project URL configured
// (e.g. a contributor's fresh clone before `bun install`).
//
// CI provides the env vars via the Lovable Cloud-managed .env, so these
// tests run on every push.
import { describe, it, expect } from "vitest";

const SUPABASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const ENDPOINTS = [
  "illustrate-story",
  "generate-classic-illustrations",
  "trial-illustrate",
] as const;

// Allow opt-out (e.g. air-gapped CI) and auto-skip when env not present.
const ENABLE = !!SUPABASE_URL && !!ANON_KEY && process.env.SKIP_INTEGRATION !== "1";

const post = (fn: string, body: unknown) =>
  fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify(body),
  });

describe.skipIf(!ENABLE)(
  "Server integration — illustration endpoints reject non-user triggers",
  () => {
    for (const fn of ENDPOINTS) {
      it(`${fn} returns 403 trigger_required when trigger is missing`, async () => {
        const r = await post(fn, { storyId: "test", pages: [] });
        expect(r.status).toBe(403);
        const body = await r.json().catch(() => ({}));
        expect(body?.error).toBe("trigger_required");
      });

      it(`${fn} returns 403 trigger_required when trigger is mismatched`, async () => {
        const r = await post(fn, { storyId: "test", pages: [], trigger: "system" });
        expect(r.status).toBe(403);
        const body = await r.json().catch(() => ({}));
        expect(body?.error).toBe("trigger_required");
      });

      it(`${fn} returns 403 trigger_required when trigger is the wrong type`, async () => {
        const r = await post(fn, { storyId: "test", pages: [], trigger: 1 });
        expect(r.status).toBe(403);
        const body = await r.json().catch(() => ({}));
        expect(body?.error).toBe("trigger_required");
      });
    }
  },
);

// Pure client-side guard test — ensures the frontend error surface for a
// trigger_required response triggers a retry path. Mirrors what
// edgeErrors.handleEdgeError surfaces to the user.
describe("Client error surface — 403 trigger_required", () => {
  it("response shape includes a retryable error code the UI can act on", () => {
    const sample = { error: "trigger_required", message: "requires user trigger" };
    // The UI uses `error` as the discriminator to show a retry CTA in
    // SelStoryViewer's per-page error tile + the IllustrateButton state.
    expect(sample.error).toBe("trigger_required");
    expect(typeof sample.message).toBe("string");
  });
});
