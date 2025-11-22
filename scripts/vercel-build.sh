#!/usr/bin/env bash

# Vercel Build Script for GitPulse
# Deploys Convex functions and builds Next.js application
#
# Convex Pro Architecture:
# - Production: Uses prod: deploy key → impressive-parrot-570 backend
# - Preview: Uses preview: deploy key → branch-named isolated backends
#
# The deploy key TYPE determines backend routing automatically.
# NEXT_PUBLIC_CONVEX_URL is auto-set by `npx convex deploy`.

set -euo pipefail

echo "🔍 Detected Vercel environment: ${VERCEL_ENV:-unknown}"

# Validate CONVEX_DEPLOY_KEY is set
if [ -z "${CONVEX_DEPLOY_KEY:-}" ]; then
  echo "❌ ERROR: CONVEX_DEPLOY_KEY not set"
  echo ""
  echo "This environment variable is required to deploy Convex functions."
  echo "Set it in Vercel dashboard: Settings → Environment Variables"
  echo ""
  echo "Deploy key types:"
  echo "  - Production: Deploy key starting with 'prod:' (targets production backend)"
  echo "  - Preview: Deploy key starting with 'preview:' (creates branch-named backends)"
  echo ""
  echo "To get your deploy keys:"
  echo "  1. Visit https://dashboard.convex.dev"
  echo "  2. Navigate to Settings → Project Settings → Deploy Keys"
  echo "  3. Generate production and preview deploy keys"
  echo ""
  echo "Current environment variables available:"
  env | grep -E "^(VERCEL_|NEXT_PUBLIC_|NODE_)" || echo "(none found)"
  exit 1
fi

# Detect deploy key type for logging
if [[ "${CONVEX_DEPLOY_KEY}" == prod:* ]]; then
  echo "🚀 Production deployment: using production Convex backend"
elif [[ "${CONVEX_DEPLOY_KEY}" == preview:* ]]; then
  echo "🔀 Preview deployment: creating isolated Convex backend for branch"
else
  echo "⚠️  Warning: Unknown deploy key type (expected 'prod:...' or 'preview:...')"
fi

echo ""
echo "📦 Deploying Convex functions and building Next.js..."
echo ""

# Retry function with exponential backoff
# Handles transient Convex API failures (500, 503 errors)
retry_with_backoff() {
  local max_attempts=3
  local timeout=1
  local attempt=1
  local exitCode=0

  while [[ $attempt -le $max_attempts ]]; do
    echo "🔄 Deployment attempt $attempt/$max_attempts..."

    if "$@"; then
      echo "✅ Deployment succeeded on attempt $attempt"
      return 0
    else
      exitCode=$?
    fi

    if [[ $attempt -lt $max_attempts ]]; then
      echo "⚠️  Attempt $attempt failed (exit code: $exitCode)"
      echo "⏳ Retrying in ${timeout}s..."
      sleep $timeout
      timeout=$((timeout * 2))
    fi

    attempt=$((attempt + 1))
  done

  echo ""
  echo "❌ All $max_attempts deployment attempts failed (exit code: $exitCode)"
  echo ""
  echo "This may indicate:"
  echo "  1. Transient Convex API outage (check https://status.convex.dev)"
  echo "  2. Invalid CONVEX_DEPLOY_KEY"
  echo "  3. Network connectivity issues"
  echo "  4. Convex backend deployment quota exceeded"
  echo ""
  echo "To debug:"
  echo "  - Verify CONVEX_DEPLOY_KEY is correct in Vercel environment variables"
  echo "  - Check Convex dashboard for deployment status and errors"
  echo "  - Review Convex backend logs for this deployment"
  echo ""
  echo "To retry manually:"
  echo "  npx convex deploy --cmd 'pnpm build'"
  echo ""
  return $exitCode
}

# Deploy Convex functions with retry logic, then build Next.js
# The --cmd flag ensures Next.js build happens after Convex deployment
# This allows Next.js to use the auto-generated NEXT_PUBLIC_CONVEX_URL
# Retries: 3 attempts with exponential backoff (1s, 2s, 4s)
retry_with_backoff npx convex deploy --cmd 'pnpm build'
