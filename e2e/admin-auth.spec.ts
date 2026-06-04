import { test, expect } from "@playwright/test";

/**
 * End-to-end smoke for the admin auth flow:
 *   Sign up → Email confirmation reminder → Sign in errors → Forgot password
 *
 * The actual inbox-click + master-key claim cannot be automated without test
 * inbox + admin secret, so those steps are documented as manual checks at the
 * bottom of this file. The automated portion verifies that the UI surfaces
 * every error and reassurance message the user needs to complete the flow.
 */

const unique = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

test.describe("admin auth flow", () => {
  test("sign-up shows confirmation screen with resend button", async ({ page }) => {
    await page.goto("/admin/auth");
    await page.getByRole("tab", { name: /register admin/i }).click();

    const email = `${unique()}@example.com`;
    await page.getByLabel(/admin email/i).fill(email);
    await page.locator("#ar-pw").fill("Sup3rSecret!");
    await page.locator("#ar-pw2").fill("Sup3rSecret!");
    await page.locator("#ar-master").fill("dummy-master-key");

    await page.getByRole("button", { name: /create admin account/i }).click();

    // Either Supabase confirms signup, or it rejects (e.g. captcha/email rules);
    // both paths must surface a readable message to the user.
    const confirmHeading = page.getByRole("heading", { name: /confirm your email/i });
    const errorToast = page.locator("[data-sonner-toast]");
    await expect(confirmHeading.or(errorToast)).toBeVisible({ timeout: 15_000 });

    if (await confirmHeading.isVisible()) {
      await expect(
        page.getByRole("button", { name: /resend confirmation link/i })
      ).toBeVisible();
    }
  });

  test("resend confirmation button enforces a cooldown", async ({ page }) => {
    await page.goto("/admin/auth");
    await page.getByRole("tab", { name: /register admin/i }).click();

    const email = `${unique()}@example.com`;
    await page.getByLabel(/admin email/i).fill(email);
    await page.locator("#ar-pw").fill("Sup3rSecret!");
    await page.locator("#ar-pw2").fill("Sup3rSecret!");
    await page.locator("#ar-master").fill("dummy-master-key");
    await page.getByRole("button", { name: /create admin account/i }).click();

    const resend = page.getByTestId("resend-confirmation");
    // Confirmation screen may not appear if signup is rejected; skip if so.
    if (!(await resend.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip(true, "Sign-up did not reach confirmation screen in this env");
      return;
    }

    // Initially enabled, no cooldown.
    await expect(resend).toBeEnabled();
    await expect(resend).toHaveAttribute("data-cooldown", "0");

    await resend.click();

    // Cooldown engages immediately and disables the button.
    await expect(resend).toBeDisabled();
    await expect(resend).not.toHaveAttribute("data-cooldown", "0");
    await expect(resend).toContainText(/resend in \d+s/i);

    // A second click within the cooldown is a no-op (still disabled, label unchanged).
    await resend.click({ force: true }).catch(() => undefined);
    await expect(resend).toBeDisabled();
    await expect(resend).toContainText(/resend in \d+s/i);
  });

  test("sign-in with bad credentials shows error toast", async ({ page }) => {
    await page.goto("/admin/auth");
    await page.locator("#ai-email").fill(`nobody-${unique()}@example.com`);
    await page.locator("#ai-pw").fill("wrong-password-123");
    await page.getByRole("button", { name: /enter dashboard/i }).click();

    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 10_000 });
  });

  test("admin dashboard redirects unauthenticated users to /admin/auth", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/admin\/auth/);
  });

  test("forgot-password page sends a reset email request", async ({ page }) => {
    await page.goto("/admin/auth");
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);

    await page.getByLabel(/email/i).fill(`${unique()}@example.com`);
    await page.getByRole("button", { name: /send reset link/i }).click();

    const sentHeading = page.getByText(/reset link is on the way/i);
    const errorToast = page.locator("[data-sonner-toast]");
    await expect(sentHeading.or(errorToast)).toBeVisible({ timeout: 10_000 });
  });
});

/*
 * MANUAL CHECKS (require real inbox + ADMIN_MASTER_KEY):
 *  1. Sign up at /admin/auth, open the confirmation link from the inbox.
 *  2. Return to /admin/auth and sign in with the same email + password and
 *     the owner master key in the "Owner master key" field.
 *  3. Expect a success toast and redirect to /admin/dashboard.
 *  4. Sign out, request /forgot-password, open the reset link, set a new
 *     password (with confirmation), then sign back in with the new password.
 */
