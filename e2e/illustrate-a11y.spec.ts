/**
 * E2E coverage for accessibility of the illustration flow.
 *
 * Validates:
 *   1. A polite ARIA live region (`role="status" aria-live="polite"`)
 *      mirrors the toast lifecycle (queued → generating → failed/ready),
 *      so screen-reader users get the same narrative as sighted users.
 *   2. Each per-page progress dot exposes its status via `aria-label`
 *      that a screen reader can read (e.g. "Page 2 error").
 *   3. The readiness badge has `aria-live` so updates are announced
 *      without focus change.
 *
 * NOTE: Playwright does not drive a real screen reader. We instead assert
 * the DOM affordances the ATs rely on (role, aria-live, aria-label, text
 * content of the live region) — which is what WCAG SC 4.1.3 (Status
 * Messages) requires.
 */
import { test, expect, type Route } from "@playwright/test";

const ILLUSTRATE_URL = /illustrate-story/;

const buildResponse = (
  outcomes: { index: number; ok: boolean; error?: string }[],
) => ({
  storyId: "harness-story",
  illustrations: outcomes.map((o) => ({
    index: o.index,
    imageUrl: o.ok ? `https://example.test/img-${o.index}.png` : null,
    status: o.ok ? "ready" : "failed",
    error: o.error,
  })),
});

test.describe("illustration a11y — ARIA live announcements", () => {
  test("announces queued → generating → failed and per-page statuses", async ({ page }) => {
    let held: Route | null = null;
    let release: (() => void) | null = null;
    await page.route(ILLUSTRATE_URL, async (route) => {
      held = route;
      // Hold open long enough for the harness to flip to the "generating"
      // toast phase (delay is 120ms inside the harness).
      await new Promise<void>((r) => (release = r));
      await held!.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildResponse([
          { index: 1, ok: true },
          { index: 2, ok: false, error: "ai_timeout" },
          { index: 3, ok: true },
        ])),
      });
    });

    await page.goto("/test/illustrate-harness");

    const live = page.getByTestId("illustration-live-region");
    // 1. Live region exists with the correct ARIA wiring.
    await expect(live).toHaveAttribute("role", "status");
    await expect(live).toHaveAttribute("aria-live", "polite");
    await expect(live).toHaveAttribute("aria-atomic", "true");

    // 2. Readiness badge is also a polite live region.
    const badge = page.getByTestId("illustration-readiness-badge");
    await expect(badge).toHaveAttribute("aria-live", "polite");

    // Kick off a job.
    await page.getByTestId("harness-illustrate").click();

    // 3a. Queued announcement.
    await expect(live).toHaveText(/Queued 3 illustration/i);

    // 3b. Generating announcement (after the harness's 120ms tick).
    await expect(live).toHaveText(/Generating 3 illustration/i);

    // 4. Per-page dots expose a screen-reader-readable label while in
    //    the "generating" state.
    const dot2 = page.getByTestId("illustration-page-2");
    await expect(dot2).toHaveAttribute("aria-label", /Page 2 generating/i);

    // Release the response.
    release!();

    // 5. Failure announcement is read out.
    await expect(live).toHaveText(/2 ready, 1 failed.*[Rr]etry/);

    // 6. Failed dot's aria-label updates so an SR user knows which page.
    await expect(dot2).toHaveAttribute("aria-label", /Page 2 error/i);

    // 7. Readiness badge text updates (it's aria-live, so it gets read).
    await expect(badge).toContainText(/2\/3 ready/);
  });

  test("announces all-ready when every page succeeds", async ({ page }) => {
    await page.route(ILLUSTRATE_URL, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildResponse([
          { index: 1, ok: true },
          { index: 2, ok: true },
          { index: 3, ok: true },
        ])),
      });
    });

    await page.goto("/test/illustrate-harness");
    await page.getByTestId("harness-illustrate").click();

    const live = page.getByTestId("illustration-live-region");
    await expect(live).toHaveText(/All 3 illustrations are ready/i);
    await expect(page.getByTestId("illustration-page-1"))
      .toHaveAttribute("aria-label", /Page 1 complete/i);
  });
});
