import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * Determine the base URL for OAuth callbacks based on environment.
 *
 * Priority:
 * 1. Explicit NEXT_PUBLIC_BASE_URL override
 * 2. Vercel production → gitpulse.app
 * 3. Vercel preview → gitpulse.app (OAuth completes on prod, user already has Clerk session)
 * 4. Local development → localhost:3000
 */
function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  if (process.env.VERCEL_ENV === "production") {
    return "https://gitpulse.app";
  }

  // Preview deployments redirect OAuth to production
  // (dynamic preview URLs can't be registered as callbacks)
  if (process.env.VERCEL_URL) {
    return "https://gitpulse.app";
  }

  return "http://localhost:3000";
}

/**
 * GitHub OAuth initiation route
 *
 * Redirects user to GitHub authorization page with proper OAuth parameters.
 * Generates CSRF state token for security validation in callback.
 */
export async function GET() {
  // Get OAuth configuration from environment
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = getBaseUrl();

  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "GitHub OAuth not configured. Set GITHUB_CLIENT_ID environment variable.",
      },
      { status: 500 },
    );
  }

  // Generate CSRF state token
  const state = randomBytes(32).toString("hex");

  // Build GitHub authorization URL
  const redirectUri = `${baseUrl}/api/auth/github/callback`;
  const scope = "repo,user,read:org"; // Read all repos, user profile, org membership

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  // Store state in cookie for validation in callback
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
