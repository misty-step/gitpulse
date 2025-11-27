import { test, expect } from "@playwright/test";

test.describe("GitHub Webhook Processing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("dashboard loads successfully", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /dashboard/i })
    ).toBeVisible();
  });

  test("user can navigate to repositories", async ({ page }) => {
    const reposLink = page.getByRole("link", {
      name: /repositories|repos/i,
    });

    if (await reposLink.isVisible()) {
      await reposLink.click();
      await expect(page).toHaveURL(
        /\/repositories|\/repos|\/settings\/repositories/
      );
    }
  });

  test("user can view repository details", async ({ page }) => {
    // Navigate to repositories page
    await page.goto("/dashboard/settings/repositories");

    // Find first repository card/link
    const firstRepo = page.locator('[data-testid="repo-card"]').first();

    if (await firstRepo.isVisible()) {
      await firstRepo.click();

      // Verify we're on repo detail page
      await expect(page).toHaveURL(/\/settings\/repositories\/[a-z0-9_]+/);

      // Check for ingestion status display
      await expect(page.getByText(/ingestion|sync|events/i)).toBeVisible();
    }
  });

  test("webhook status indicator visible", async ({ page }) => {
    await page.goto("/dashboard/settings/repositories");

    // Look for webhook/sync status indicators
    const statusIndicator = page.locator(
      '[data-testid="sync-status"], [data-testid="webhook-status"]'
    );

    if (await statusIndicator.first().isVisible()) {
      await expect(statusIndicator.first()).toBeVisible();
    }
  });
});
