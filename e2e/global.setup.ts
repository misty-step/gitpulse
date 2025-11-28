import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import * as path from "path";
import { fileURLToPath } from "url";

// ES module-compatible path resolution
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, "../playwright/.clerk/user.json");

setup("authenticate test user", async ({ page }) => {
  // Configure Clerk for testing (must be called before signIn)
  await clerkSetup();

  // Navigate to index page (loads Clerk, required before signIn)
  await page.goto("/");

  // Sign in using Clerk's test helper
  await clerk.signIn({
    page,
    signInParams: {
      strategy: "password",
      identifier: process.env.E2E_CLERK_USER_EMAIL!,
      password: process.env.E2E_CLERK_USER_PASSWORD!,
    },
  });

  // Navigate to dashboard (signIn doesn't auto-redirect)
  await page.goto("/dashboard");

  // Verify we're authenticated - new users see onboarding flow
  await page.waitForSelector('h1:has-text("Connect Your GitHub Account")', {
    timeout: 5000,
  });

  // Save authenticated state for reuse across tests
  await page.context().storageState({ path: authFile });
});
