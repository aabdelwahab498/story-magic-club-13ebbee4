/**
 * End-to-end coverage for the illustration flow.
 *
 * Verifies:
 *  1. Queued state appears immediately with a queued-at timestamp.
 *  2. Retry button stays disabled until at least one job has failed.
 *  3. Readiness badge updates as illustrations become available.
 *  4. Client-side idempotency / dedup: mashing Retry never spawns more than
 *     one in-flight job per (story,page).
 *  5. Toast notifications surface queued / generating / failed states so a
 *     parent always knows what happened.
 */
import { test, expect, type Route } from "@playwright/test";

const ILLUSTRATE_URL = /\/illustrations/;

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

test.describe("illustrate flow", () => {
  test("queued → generating → ready, badge updates, retry stays disabled", async ({ page }) => {
    // Slow the network so the queued / generating state is visible.
    let resolveFirst: ((r: Route) => void) | null = null;
    const firstHit = new Promise<Route>((res) => (resolveFirst = res));

    let hits = 0;
    await page.route(ILLUSTRATE_URL, async (route) => {
      hits += 1;
      if (hits === 1) {
        resolveFirst?.(route);
        return; // hold open until the test fulfils it
      }
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

    const retry = page.getByTestId("illustration-retry-failed");
    await expect(retry).toBeDisabled();

    await page.getByTestId("harness-illustrate").click();

    // While the first request is still in flight all three dots should be
    // in the "generating" state and the queued-at timestamp must be set.
    const dot1 = page.getByTestId("illustration-page-1");
    await expect(dot1).toHaveAttribute("data-status", "generating");
    const queuedAt = await dot1.getAttribute("data-queued-at");
    expect(Number(queuedAt)).toBeGreaterThan(0);

    // Queued toast should show.
    await expect(page.getByText(/Queued 3 illustration/i)).toBeVisible();

    // Release the response.
    const r = await firstHit;
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildResponse([
        { index: 1, ok: true },
        { index: 2, ok: true },
        { index: 3, ok: true },
      ])),
    });

    await expect(page.getByTestId("illustration-readiness-badge"))
      .toHaveText(/All illustrations ready \(3\/3\)/);
    await expect(dot1).toHaveAttribute("data-status", "complete");

    // No failures → retry still disabled.
    await expect(retry).toBeDisabled();
  });

  test("failed pages enable Retry, and repeated Retry presses dedup", async ({ page }) => {
    let calls = 0;
    await page.route(ILLUSTRATE_URL, async (route) => {
      calls += 1;
      // First call: page 2 fails. Second call (retry): page 2 succeeds.
      const body = calls === 1
        ? buildResponse([
            { index: 1, ok: true },
            { index: 2, ok: false, error: "ai_timeout" },
            { index: 3, ok: true },
          ])
        : buildResponse([{ index: 2, ok: true }]);
      // Small delay so dedup window is observable.
      await new Promise((res) => setTimeout(res, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/test/illustrate-harness");
    await page.getByTestId("harness-illustrate").click();

    const retry = page.getByTestId("illustration-retry-failed");
    await expect(retry).toContainText(/Retry 1 failed/);
    await expect(retry).toBeEnabled();
    await expect(page.getByTestId("illustration-page-2"))
      .toHaveAttribute("data-status", "error");

    // Failed toast surfaced.
    await expect(page.getByText(/2 ready, 1 failed/i)).toBeVisible();

    // Hammer the Retry button — dedup must collapse this to a single job.
    const before = await page.evaluate(() =>
      (window as unknown as { __illustrateCalls: () => number }).__illustrateCalls(),
    );
    await Promise.all([
      retry.click(),
      retry.click().catch(() => {}),
      retry.click().catch(() => {}),
    ]);

    await expect(page.getByTestId("illustration-readiness-badge"))
      .toHaveText(/All illustrations ready \(3\/3\)/);

    const after = await page.evaluate(() =>
      (window as unknown as { __illustrateCalls: () => number }).__illustrateCalls(),
    );
    // Exactly one retry job should have been issued despite three clicks.
    expect(after - before).toBe(1);
    // Network was hit exactly twice total (initial + one retry).
    expect(calls).toBe(2);

    // Retry disables again once nothing has failed.
    await expect(retry).toBeDisabled();
  });

  test("partial failure: retry payload only includes failed pages, others stay ready", async ({ page }) => {
    const requestBodies: { pageIndices: number[]; idempotencyKey?: string }[] = [];
    let calls = 0;
    await page.route(ILLUSTRATE_URL, async (route) => {
      calls += 1;
      const post = route.request().postDataJSON() as {
        pages?: { index: number }[];
        idempotencyKey?: string;
      };
      requestBodies.push({
        pageIndices: (post.pages ?? []).map((p) => p.index),
        idempotencyKey: post.idempotencyKey,
      });
      const body = calls === 1
        ? buildResponse([
            { index: 1, ok: true },
            { index: 2, ok: false, error: "ai_timeout" },
            { index: 3, ok: false, error: "ai_timeout" },
          ])
        : buildResponse(
            (post.pages ?? []).map((p) => ({ index: p.index, ok: true })),
          );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });

    await page.goto("/test/illustrate-harness");
    await page.getByTestId("harness-illustrate").click();

    // Mixed state visible: 1 ready, 2 failed.
    await expect(page.getByTestId("illustration-page-1")).toHaveAttribute("data-status", "complete");
    await expect(page.getByTestId("illustration-page-2")).toHaveAttribute("data-status", "error");
    await expect(page.getByTestId("illustration-page-3")).toHaveAttribute("data-status", "error");
    await expect(page.getByTestId("illustration-readiness-badge"))
      .toContainText(/1\/3 ready/);

    const retry = page.getByTestId("illustration-retry-failed");
    await expect(retry).toContainText(/Retry 2 failed/);
    await retry.click();

    await expect(page.getByTestId("illustration-readiness-badge"))
      .toHaveText(/All illustrations ready \(3\/3\)/);

    // Exactly two network calls: initial + one retry.
    expect(calls).toBe(2);
    // Retry must NOT re-request page 1 (already ready).
    expect(requestBodies[1].pageIndices.sort()).toEqual([2, 3]);
    // Both requests carry an idempotencyKey so the server can dedup.
    expect(requestBodies[0].idempotencyKey).toBeTruthy();
    expect(requestBodies[1].idempotencyKey).toBeTruthy();
    expect(requestBodies[0].idempotencyKey).not.toBe(requestBodies[1].idempotencyKey);
  });
});

