/**
 * E2E coverage for the admin Illustration Analytics audit log panel.
 *
 * Verifies:
 *  1. An unauthenticated user is redirected away from / cannot view the
 *     admin analytics page (admin-only access).
 *  2. The audit panel surfaces filters (admin ID, user agent, from/to)
 *     and pagination controls.
 *  3. Filter changes trigger a fresh audit fetch (insert is best-effort
 *     and happens when the events list is reloaded — covered by the
 *     main analytics page; here we exercise the audit-panel filter UI).
 *
 * Server-side RLS is covered by `src/test/audit-log-rls.integration.test.ts`.
 */
import { test, expect } from "@playwright/test";

const ADMIN_ROUTE = "/admin/dashboard/illustration-analytics";

test.describe("admin illustration analytics audit log", () => {
  test("unauthenticated user cannot view the admin analytics page", async ({ page }) => {
    await page.goto(ADMIN_ROUTE);
    // ProtectedRoute either redirects to /auth or renders an unauthorised state.
    // Either way the audit table must NOT be in the DOM.
    await expect(page.getByTestId("audit-table")).toHaveCount(0);
  });

  test("audit filters + pagination controls render together (skipped without admin session)", async ({
    page,
  }) => {
    // This test only runs when an admin session cookie is available via
    // E2E_ADMIN_STORAGE_STATE. Otherwise we skip — Playwright treats this
    // as success in environments without admin auth (preview/CI).
    test.skip(
      !process.env.E2E_ADMIN_STORAGE_STATE,
      "admin storage state not provided",
    );

    await page.goto(ADMIN_ROUTE);
    await expect(page.getByTestId("audit-filter-admin")).toBeVisible();
    await expect(page.getByTestId("audit-filter-ua")).toBeVisible();
    await expect(page.getByTestId("audit-filter-from")).toBeVisible();
    await expect(page.getByTestId("audit-filter-to")).toBeVisible();
    await expect(page.getByTestId("audit-apply")).toBeVisible();
    await expect(page.getByTestId("audit-prev")).toBeVisible();
    await expect(page.getByTestId("audit-next")).toBeVisible();
    await expect(page.getByTestId("audit-page-info")).toContainText(/Page \d+/);

    // Apply a filter and confirm a fresh query is issued.
    let auditRequests = 0;
    await page.route(/illustration_analytics_audit/, (route) => {
      auditRequests += 1;
      route.continue();
    });
    await page.getByTestId("audit-filter-ua").fill("Chrome");
    await page.getByTestId("audit-apply").click();
    await expect.poll(() => auditRequests).toBeGreaterThan(0);
  });
});
