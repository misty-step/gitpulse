import { clerkSetup, clerk } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import * as path from "path";

const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("global setup - configure Clerk", async () => {
  await clerkSetup();
});

setup("authenticate test user", async ({ page }) => {
  // Navigate to sign-in page
  await page.goto("/sign-in");

  // Use Clerk's helper to sign in with password strategy
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_USER_USERNAME!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  });

  // Wait for redirect to dashboard
  await page.waitForURL("/dashboard", { timeout: 10000 });

  // Verify we're authenticated
  await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 5000 });

  // Save authenticated state for reuse
  await page.context().storageState({ path: authFile });
});
