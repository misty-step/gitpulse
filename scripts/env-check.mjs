#!/usr/bin/env node
import process from "node:process";

const REQUIRED = [
  {
    key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    description: "Clerk publishable key for browser SDK",
  },
  {
    key: "CLERK_SECRET_KEY",
    description: "Clerk secret key for server-side auth and webhooks",
  },
  {
    key: "NEXT_PUBLIC_CONVEX_URL",
    description: "Convex deployment URL for client",
  },
];

const missing = REQUIRED.filter(({ key }) => !process.env[key]);
const skip = process.env.SKIP_ENV_CHECK === "true";
const enforce =
  process.env.ENFORCE_ENV_VARS === "true" || process.env.VERCEL === "1";

if (missing.length === 0) {
  console.log("✅ Environment check passed");
  process.exit(0);
}

const message = [
  "❌ Missing required environment variables:",
  ...missing.map(({ key, description }) => `- ${key}: ${description}`),
  "\nSet these in your environment (.env.local or Vercel project settings).",
].join("\n");

if (skip && !enforce) {
  console.warn(message);
  console.warn("SKIP_ENV_CHECK=true set; continuing (not recommended).\n");
  process.exit(0);
}

if (!enforce && process.env.CI !== "true") {
  console.warn(message);
  console.warn(
    "Run with ENFORCE_ENV_VARS=true to make this a hard failure (CI/Vercel enforce by default).\n",
  );
  process.exit(0);
}

console.error(message);
process.exit(1);
