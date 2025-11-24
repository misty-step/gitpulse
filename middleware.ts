import { clerkMiddleware } from "@clerk/nextjs/server";

import { publicRouteMatcher } from "@/lib/auth/publicRoutes";

export default clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  if (!publicRouteMatcher(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
