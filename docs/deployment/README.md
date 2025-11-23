# Deployment Documentation

## Overview

This directory contains documentation for managing deployments with Vercel + Convex + Clerk.

## Quick Links

- **🚨 [Quick Start](./QUICK_START.md)** - Immediate fix for CI build failure (5 minutes)
- **📚 [Preview Deployments Guide](./PREVIEW_DEPLOYMENTS_GUIDE.md)** - Comprehensive guide to preview deployments
- **🔍 [CI Failure Summary](../../CI-FAILURE-SUMMARY.md)** - Detailed analysis of current CI issue
- **📋 [Resolution Plan](../../CI-RESOLUTION-PLAN.md)** - Actionable resolution steps

## Problem Summary

**Current Issue:** CI Build job fails with missing `CLERK_JWT_ISSUER_DOMAIN` environment variable

**Root Cause:** CI deploys to Convex preview deployments which are isolated and don't inherit environment variables from development environment.

**Quick Fix:** Set Convex default environment variables for preview deployments.

**Long-Term:** Choose between Vercel-managed or CI-managed deployment strategy.

## Documentation Structure

```
docs/deployment/
├── README.md (this file)                    # Documentation index
├── QUICK_START.md                           # Immediate fix (5 min)
└── PREVIEW_DEPLOYMENTS_GUIDE.md             # Comprehensive guide

CI-FAILURE-SUMMARY.md                        # Root cause analysis
CI-RESOLUTION-PLAN.md                        # Detailed fix plan
```

## Deployment Architecture

### Current Setup

```
GitHub PR → GitHub Actions CI → Convex Preview Deployment
   ↓              ↓
   └─────────────┴──────── Quality Gates (pass/fail)

Build Job → npx convex deploy → hardy-bobcat-281.convex.cloud
              ❌ Missing CLERK_JWT_ISSUER_DOMAIN
```

### Recommended Setup (Vercel-Managed)

```
GitHub PR → Vercel → Convex Preview Deployment ✅
                │
                └──→ Next.js Build → Preview URL

GitHub Actions CI → Quality Gates Only
   ├── Typecheck
   ├── Lint
   ├── Test
   ├── Security Scan
   └── Secrets Scan
```

## Next Steps

### 1. Immediate Fix (Do Now)

Follow [QUICK_START.md](./QUICK_START.md):

1. Set Convex default environment variable
2. Rerun CI
3. Verify build passes

**Time:** 5 minutes

### 2. Choose Long-Term Strategy

Read [PREVIEW_DEPLOYMENTS_GUIDE.md](./PREVIEW_DEPLOYMENTS_GUIDE.md) and choose:

**Option A: Vercel-Managed (Recommended)**

- Official Convex best practice
- Automatic preview deployments
- Simpler setup

**Option B: CI-Managed**

- More control
- No preview deployments for PRs
- More complex

**Time:** 30-60 minutes

### 3. Implement & Test

Follow the chosen approach from the guide:

- Configure Convex/Vercel
- Update CI configuration
- Test with new PR
- Document changes

**Time:** 1-2 hours

## Key Concepts

### Preview Deployments

**What:** Isolated Convex backend instance per Git branch
**Why:** Test backend changes alongside frontend changes in isolation
**How:** Automatic with Vercel, or manual via CI
**Lifetime:** 14 days, then auto-cleanup

### Default Environment Variables

**What:** Variables that apply to ALL preview/dev deployments automatically
**Where:** Convex Dashboard → Settings → Environment Variables → Defaults
**Use For:** Shared configuration (API keys, auth domains, etc.)
**Don't Use For:** Production secrets

### Deploy Keys

**Production Deploy Key:**

- Deploys to production Convex deployment
- Use in Vercel production environment
- Use in CI for master branch only

**Preview Deploy Key:**

- Creates new Convex deployment per branch
- Use in Vercel preview environment
- Use in CI for all branches (current setup)

## Environment Variables Reference

### Required for Preview Deployments

```bash
# Clerk Authentication
CLERK_JWT_ISSUER_DOMAIN=finer-llama-61.clerk.accounts.dev

# Optional: Shared API Keys (if needed)
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=AIza...
# VOYAGE_API_KEY=pa-...
```

Set these as Convex **default environment variables** for Preview + Development.

### Required for Production

```bash
# Clerk Authentication (Production Instance)
CLERK_JWT_ISSUER_DOMAIN=your-production.clerk.accounts.dev

# Production API Keys
# ... (set in Convex production environment)
```

Set these in Convex **production environment** only.

## FAQs

### Why does CI deploy to preview environments?

Your `CONVEX_DEPLOY_KEY` secret is a **preview deploy key**, which creates isolated deployments per branch. This is useful for testing but requires proper environment variable configuration.

### Should I use Vercel or CI for deployments?

**Vercel (Recommended):**

- Official Convex best practice
- Simpler setup
- Automatic preview deployments

**CI:**

- More control
- Centralized deployment logic
- Requires more configuration

### What's the difference between dev, preview, and production?

**Development:**

- Your local environment
- Convex dev deployment
- Environment variables in `.env.local`

**Preview:**

- PR branches
- Temporary Convex deployments
- Auto-cleanup after 14 days
- Use default environment variables

**Production:**

- Master branch
- Permanent Convex deployment
- Dedicated environment variables

### How do I add more environment variables?

1. **For Preview/Dev:** Add to Convex default environment variables
2. **For Production:** Add to Convex production environment
3. **For Vercel:** Add to Vercel environment variables (if needed by Next.js)

## Troubleshooting

### Build still fails after setting default variable

1. Check variable is set for **Preview + Development** (not Production)
2. Create new preview deployment to test
3. Check Convex dashboard for the specific preview deployment's variables

### Preview deployment works but production fails

Different environment variable configuration. Ensure production environment has all required variables.

### Vercel deployment fails

Check Vercel build logs for specific error. Common issues:

- Missing `CONVEX_DEPLOY_KEY` in Vercel environment variables
- Incorrect build command
- Missing other required environment variables

## References

- [Convex Docs: Preview Deployments](https://docs.convex.dev/production/hosting/preview-deployments)
- [Convex Docs: Vercel Integration](https://docs.convex.dev/production/hosting/vercel)
- [Clerk Docs: Multi-Environment](https://clerk.com/docs/deployments/overview)
- [Vercel Docs: Environment Variables](https://vercel.com/docs/projects/environment-variables)

---

**Last Updated:** 2025-11-22
**Status:** Documentation complete, fix pending implementation
