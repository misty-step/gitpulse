import { test, expect } from "@playwright/test";
import { mockAuth, mockHeaders } from "./fixtures/auth";
import { primaryUser } from "./fixtures/users";

test.describe("Auth flow", () => {
  test("signs in via GitHub mock and reaches dashboard", async ({ page }) => {
    // landing
    await page.goto("/");
    await expect(page).toHaveTitle(/GitPulse/i);

    // go to sign in
    const signInLink = page.getByRole("link", { name: /sign in/i });
    if (await signInLink.isVisible()) {
      await signInLink.click();
    } else {
      await page.goto("/sign-in");
    }

    // mock OAuth redirect flow
    await page.route("**/api/auth/github**", (route) => {
      route.fulfill({
        status: 302,
        headers: { Location: `/dashboard?code=${mockAuth.githubOauthCode}` },
      });
    });

    // pretend Clerk session cookie already present (mock auth mode)
    await page.context().addCookies([
      {
        name: "__session",
        value: mockAuth.sessionToken,
        url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
      },
    ]);

    // complete redirect
    await page.goto(`/auth/callback?code=${mockAuth.githubOauthCode}`, {
      waitUntil: "networkidle",
    });

    // dashboard assertion
    await expect(page).toHaveURL(/dashboard/);
    await expect(
      page.getByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();

    // session persists across refresh
    await page.reload();
    await expect(page).toHaveURL(/dashboard/);
  });
});
