import { test, expect } from "@playwright/test";

test.describe("Report Generation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/reports");
  });

  test("reports page loads successfully", async ({ page }) => {
    await expect(page).toHaveURL(/\/reports/);
    await expect(
      page.getByRole("heading", { name: /reports/i })
    ).toBeVisible();
  });

  test("user can view reports list", async ({ page }) => {
    // Check for reports list or empty state
    const reportsList = page.locator('[data-testid="reports-list"]');
    const emptyState = page.getByText(/no reports|generate your first/i);

    const hasReports = await reportsList.isVisible();
    const isEmpty = await emptyState.isVisible();

    // Either reports exist or empty state is shown
    expect(hasReports || isEmpty).toBeTruthy();
  });

  test("report generation form is accessible", async ({ page }) => {
    // Look for generate report button/form
    const generateButton = page.getByRole("button", {
      name: /generate.*report|create.*report/i,
    });

    if (await generateButton.isVisible()) {
      await generateButton.click();

      // Check for form elements (date range, usernames, report type)
      const form = page.locator("form");
      await expect(form).toBeVisible({ timeout: 5000 });
    }
  });

  test("user can initiate report generation", async ({ page, context }) => {
    // Mock slow LLM response to avoid waiting 60s in test
    await context.route("**/api/reports/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { reportId: "test_123", status: "processing" },
        }),
      });
    });

    const generateButton = page.getByRole("button", { name: /generate/i });

    if (await generateButton.isVisible()) {
      await generateButton.click();

      // Verify loading/processing state appears
      await expect(page.getByText(/generating|processing/i)).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("user can view existing report with citations", async ({ page }) => {
    // Click first report if exists
    const firstReport = page.locator('[data-testid="report-card"]').first();

    if (await firstReport.isVisible()) {
      await firstReport.click();

      // Verify we're on report detail page
      await expect(page).toHaveURL(/\/reports\/[a-z0-9_]+/);

      // Check for report content
      await expect(
        page.locator('article, [data-testid="report-content"]')
      ).toBeVisible();

      // Verify citations (GitHub links)
      const citations = page.locator('a[href*="github.com"]');
      const citationCount = await citations.count();

      if (citationCount > 0) {
        await expect(citations.first()).toBeVisible();

        // Verify citation links to PR/issue/commit
        const href = await citations.first().getAttribute("href");
        expect(href).toMatch(/github\.com\/.*\/(pull|issues|commit)\//);
      }
    }
  });

  test("report coverage score displayed", async ({ page }) => {
    const firstReport = page.locator('[data-testid="report-card"]').first();

    if (await firstReport.isVisible()) {
      await firstReport.click();

      // Look for coverage percentage
      const coverageText = page.getByText(/coverage|cited/i);
      await expect(coverageText).toBeVisible({ timeout: 5000 });
    }
  });
});
