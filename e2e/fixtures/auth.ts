export const mockAuth = {
  githubOauthCode: "mock-oauth-code",
  sessionToken: "mock-session-token",
  clerkUserId: "user_mock_123",
  ghLogin: "octocat",
};

export const mockHeaders = {
  authorized: {
    Cookie: `__session=${mockAuth.sessionToken}`,
  },
};
