import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { logger } from "@/lib/logger";

/**
 * GitHub OAuth callback route
 *
 * Handles the redirect from GitHub after user authorizes the app.
 * Exchanges authorization code for access token and stores in Convex.
 */
export async function GET(req: NextRequest) {
  try {
    // Get Clerk user ID
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // Get OAuth parameters from query string
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle GitHub authorization errors
    if (error) {
      const errorDescription =
        searchParams.get("error_description") || "Unknown error";
      return NextResponse.redirect(
        new URL(
          `/dashboard/settings?github=error&message=${encodeURIComponent(errorDescription)}`,
          req.url,
        ),
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?github=error&message=Missing authorization code",
          req.url,
        ),
      );
    }

    // Verify CSRF state token
    const storedState = req.cookies.get("github_oauth_state")?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?github=error&message=Invalid state token",
          req.url,
        ),
      );
    }

    // Exchange code for access token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?github=error&message=GitHub OAuth not configured",
          req.url,
        ),
      );
    }

    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?github=error&message=Failed to exchange code for token",
          req.url,
        ),
      );
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/settings?github=error&message=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
          req.url,
        ),
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Fetch GitHub user profile
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userResponse.ok) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?github=error&message=Failed to fetch GitHub user profile",
          req.url,
        ),
      );
    }

    const githubUser = await userResponse.json();

    // Store tokens in Convex
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.redirect(
        new URL(
          "/dashboard/settings?github=error&message=Convex not configured",
          req.url,
        ),
      );
    }

    const convex = new ConvexHttpClient(convexUrl);

    await convex.mutation(api.users.updateGitHubAuth, {
      clerkId: userId,
      githubAccessToken: access_token,
      githubRefreshToken: refresh_token || undefined,
      githubTokenExpiry: expires_in
        ? Date.now() + expires_in * 1000
        : Date.now() + 8 * 60 * 60 * 1000, // Default 8 hours
      githubUsername: githubUser.login,
      githubProfile: {
        id: githubUser.id,
        login: githubUser.login,
        nodeId: githubUser.node_id,
        name: githubUser.name ?? undefined,
        email: githubUser.email ?? undefined,
        avatarUrl: githubUser.avatar_url ?? undefined,
        bio: githubUser.bio ?? undefined,
        company: githubUser.company ?? undefined,
        location: githubUser.location ?? undefined,
        blog: githubUser.blog ?? undefined,
        twitterUsername: githubUser.twitter_username ?? undefined,
        publicRepos: githubUser.public_repos ?? undefined,
        publicGists: githubUser.public_gists ?? undefined,
        followers: githubUser.followers ?? undefined,
        following: githubUser.following ?? undefined,
      },
    });

    // Clear state cookie and redirect to settings with success
    const response = NextResponse.redirect(
      new URL("/dashboard/settings?github=connected", req.url),
    );
    response.cookies.delete("github_oauth_state");

    logger.info({ githubUserId: githubUser.id }, "GitHub OAuth completed");

    return response;
  } catch (error) {
    logger.error({ err: error }, "GitHub OAuth callback failed");
    return NextResponse.redirect(
      new URL(
        "/dashboard/settings?github=error&message=An unexpected error occurred",
        req.url,
      ),
    );
  }
}
