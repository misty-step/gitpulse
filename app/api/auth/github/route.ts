import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

/**
 * GitHub OAuth initiation route
 *
 * Redirects user to GitHub authorization page with proper OAuth parameters.
 * Generates CSRF state token for security validation in callback.
 */
export async function GET() {
  // Get OAuth configuration from environment
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured. Set GITHUB_CLIENT_ID environment variable." },
      { status: 500 }
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
