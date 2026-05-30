/**
 * E2E coverage for the per-page Retry disabling lifecycle.
 *
 * Contract under test (production behaviour, mirrored in the harness):
 *   1. Initial state: Retry is disabled (no failures yet).
 *   2. After a failure: Retry becomes enabled and labelled with the count.
 *   3. While the user is mid-retry on that failed page: Retry MUST be
 *      disabled again (and labelled "Retrying…") so a second click can't
 *      requeue the same page.
 *   4. After the retried page returns:
 *        - if it succeeded → Retry stays disabled (nothing left to retry).
 *        - if it failed again → Retry re-enables.
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

test.describe("Retry button per-page disabling", () => {
  test("disabled while retrying, re-enabled after retry fails", async ({ page }) => {
    let calls = 0;
    let heldRoute: Route | null = null;
    let releaseRetry: (() => void) | null = null;

    await page.route(ILLUSTRATE_URL, async (route) => {
      calls += 1;
      if (calls === 1) {
        // Initial run: page 2 fails.
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildResponse([
            { index: 1, ok: true },
            { index: 2, ok: false, error: "ai_timeout" },
            { index: 3, ok: true },
          ])),
        });
        return;
      }
      // Second call (the retry): hold open so we can observe the disabled
      // state, then resolve it on demand below.
      heldRoute = route;
      await new Promise<void>((r) => (releaseRetry = r));
      await heldRoute!.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildResponse([
          { index: 2, ok: false, error: "ai_timeout_again" },
        ])),
      });
    });

    await page.goto("/test/illustrate-harness");
    const retry = page.getByTestId("illustration-retry-failed");

    // 1. Initially disabled (no failures yet).
    await expect(retry).toBeDisabled();

    await page.getByTestId("harness-illustrate").click();

    // 2. After failure → enabled and labelled with the count.
    await expect(retry).toContainText(/Retry 1 failed/);
    await expect(retry).toBeEnabled();
    await expect(page.getByTestId("illustration-page-2"))
      .toHaveAttribute("data-status", "error");

    // 3. Click Retry — request is now held open by the route handler.
    await retry.click();

    // While the retry is in flight Retry must be disabled and re-labelled.
    await expect(retry).toBeDisabled();
    await expect(retry).toContainText(/Retrying/i);
    await expect(retry).toHaveAttribute("aria-disabled", "true");

    // Release the retry — server reports failure again.
    releaseRetry!();

    // 4. After retry fails → Retry re-enables and shows the count again.
    await expect(page.getByTestId("illustration-page-2"))
      .toHaveAttribute("data-status", "error");
    await expect(retry).toContainText(/Retry 1 failed/);
    await expect(retry).toBeEnabled();
  });

  test("disabled while retrying, stays disabled after success", async ({ page }) => {
    let calls = 0;
    let heldRoute: Route | null = null;
    let releaseRetry: (() => void) | null = null;

    await page.route(ILLUSTRATE_URL, async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(buildResponse([
            { index: 1, ok: true },
            { index: 2, ok: false, error: "ai_timeout" },
            { index: 3, ok: true },
          ])),
        });
        return;
      }
      heldRoute = route;
      await new Promise<void>((r) => (releaseRetry = r));
      await heldRoute!.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildResponse([{ index: 2, ok: true }])),
      });
    });

    await page.goto("/test/illustrate-harness");
    await page.getByTestId("harness-illustrate").click();

    const retry = page.getByTestId("illustration-retry-failed");
    await expect(retry).toBeEnabled();
    await retry.click();

    // Mid-retry: locked.
    await expect(retry).toBeDisabled();
    await expect(retry).toContainText(/Retrying/i);

    releaseRetry!();

    // Page 2 succeeded → readiness reflects all-ready, Retry stays disabled.
    await expect(page.getByTestId("illustration-readiness-badge"))
      .toHaveText(/All illustrations ready \(3\/3\)/);
    await expect(retry).toBeDisabled();
  });
});
