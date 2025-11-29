import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("user can access dashboard with valid session", async ({ page }) => {
    // Auth state already loaded from global setup - go straight to protected route
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard/);
    // New users see onboarding flow
    await expect(
      page.getByRole("heading", { name: /Connect Your GitHub Account/i })
    ).toBeVisible();
  });

  test("session persists across page refreshes", async ({ page }) => {
    await page.goto("/dashboard");
    await page.reload();

    // Should still be authenticated after refresh - onboarding visible
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /Connect Your GitHub Account/i })
    ).toBeVisible();
  });

  test("session persists across navigation", async ({ page }) => {
    await page.goto("/dashboard");

    // Navigate to another protected route
    const reportsLink = page.getByRole("link", { name: /reports/i });
    if (await reportsLink.isVisible()) {
      await reportsLink.click();
      await expect(page).toHaveURL(/\/reports/);
    }

    // Navigate back
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("unauthenticated user redirected to sign-in", async ({ browser }) => {
    // Create new context WITHOUT auth state to test unauthenticated flow
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/dashboard");

    // App redirects to onboarding for unauthenticated users
    await expect(page).toHaveURL(/\/onboarding|\/sign-in/);

    await context.close();
  });
});
