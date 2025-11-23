# Preview Deployments Guide: Vercel + Convex + Clerk

## Overview

This guide explains the best practices for managing preview deployments with the Vercel + Convex + Clerk stack, based on official Convex documentation and 2024 best practices.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   GitHub    │────▶│    Vercel    │────▶│     Convex      │
│   (Source)  │     │  (Frontend)  │     │   (Backend)     │
└─────────────┘     └──────────────┘     └─────────────────┘
      │                    │                      │
      │                    ├──Production──────────┤
      │                    │  (master branch)     │
      │                    │                      │
      │                    ├──Preview─────────────┤
      │                    │  (PR branches)       │
      │                    │                      │
      └──CI Quality Gates──┘
         (typecheck, lint, test, security)
```

## Current Problem

**Symptom:** CI Build job fails with:

```
✖ Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not set.
```

**Root Cause:**

- CI uses `CONVEX_DEPLOY_KEY` to deploy to Convex
- This creates preview deployments (e.g., `hardy-bobcat-281.convex.cloud`)
- Preview deployments are isolated and don't inherit environment variables
- `CLERK_JWT_ISSUER_DOMAIN` is set in dev environment but not in preview deployments

## Solution: Two Approaches

### ✨ Approach A: Vercel-Managed Deployments (RECOMMENDED)

**Philosophy:** Let Vercel handle builds/deployments, CI handles quality validation.

#### Benefits

- ✅ Official Convex best practice
- ✅ Automatic preview deployments for every PR
- ✅ No duplication between CI and Vercel
- ✅ Cleaner separation of concerns
- ✅ Auto-cleanup of stale previews (14 days)

#### Implementation Steps

##### 1. Configure Convex Default Environment Variables

**What:** Set environment variables that apply to ALL preview and dev deployments automatically.

**How:**

1. Go to [Convex Dashboard](https://dashboard.convex.dev/)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Click **"Set Default Variables"** or **"Default Environment Variables"**
5. Add the following for **Preview + Development** environments:

```bash
CLERK_JWT_ISSUER_DOMAIN=finer-llama-61.clerk.accounts.dev
```

**Why:** Every new preview deployment will automatically receive this variable.

##### 2. Configure Vercel Environment Variables

**What:** Set up Convex deploy keys for production and preview environments.

**How:**

1. **Generate Deploy Keys (if not already done):**
   - Go to Convex Dashboard → Project Settings → Deploy Keys
   - Generate **Production Deploy Key** (if not exists)
   - Generate **Preview Deploy Key** (if not exists)

2. **Add to Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Select your project (gitpulse)
   - Navigate to **Settings** → **Environment Variables**
   - Add two `CONVEX_DEPLOY_KEY` variables:

   ```
   Variable Name: CONVEX_DEPLOY_KEY
   Value: <production-deploy-key>
   Environments: ✅ Production only
   ```

   ```
   Variable Name: CONVEX_DEPLOY_KEY
   Value: <preview-deploy-key>
   Environments: ✅ Preview only
   ```

3. **Verify Build Command:**
   - Go to **Settings** → **Build & Development Settings**
   - Ensure Build Command is:
   ```bash
   npx convex deploy --cmd 'pnpm build:app'
   ```

##### 3. Refactor GitHub Actions CI

**What:** Remove build/deployment from CI, keep only quality validation.

**How:**

Edit `.github/workflows/ci.yml`:

**REMOVE:**

```yaml
build:
  name: Build
  needs: quality-gates
  runs-on: ubuntu-latest
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
    - name: Setup pnpm
      uses: pnpm/action-setup@v4
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: "pnpm"
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
    - name: Deploy Convex
      run: npx convex deploy --cmd 'pnpm build:app'
      env:
        CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

**KEEP:**

- `trufflehog` (secrets scanning)
- `security-audit` (pnpm audit)
- `quality-gates` (typecheck, lint, test)

**Result:** CI validates code quality, Vercel handles deployment.

##### 4. Test the Setup

**Test Preview Deployment:**

1. Create a new branch and PR
2. Vercel automatically creates preview deployment
3. Verify:
   - Preview URL works
   - Convex backend is accessible
   - Clerk authentication works
   - Check Convex Dashboard for new preview deployment

**Test Production Deployment:**

1. Merge PR to `master`
2. Vercel automatically deploys to production
3. Verify production site works

##### 5. Optional: Add Preview URL Comments

Vercel automatically comments on PRs with preview URLs. If you want additional context:

```yaml
# .github/workflows/comment-preview.yml
name: Preview Deployment Comment
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  comment:
    runs-on: ubuntu-latest
    steps:
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const message = `
            ## 🚀 Preview Deployment

            Your changes are being deployed by Vercel.

            - **Frontend:** Check Vercel PR comment for URL
            - **Backend:** Convex preview deployment created automatically
            - **Branch:** ${context.payload.pull_request.head.ref}

            CI quality gates must pass before merging.
            `;
            github.rest.issues.createComment({
              ...context.repo,
              issue_number: context.issue.number,
              body: message
            });
```

---

### Approach B: CI-Managed Deployments

**Philosophy:** Keep deployment in CI, restrict to master branch only.

#### Benefits

- ✅ More control over deployment process
- ✅ Centralized in one place

#### Tradeoffs

- ❌ No preview deployments for PRs
- ❌ Against Convex official recommendations
- ❌ More complex to maintain

#### Implementation Steps

##### 1. Configure Convex Default Environment Variables

(Same as Approach A, Step 1)

##### 2. Restrict CI Build Job to Master Only

Edit `.github/workflows/ci.yml`:

```yaml
build:
  name: Build
  needs: quality-gates
  runs-on: ubuntu-latest
  # Only build on master branch
  if: github.ref == 'refs/heads/master'
  steps:
    # ... existing steps
```

##### 3. Disable Vercel Auto-Deploy (Optional)

- Vercel Dashboard → Project Settings → Git
- Disable "Automatically deploy" for branches

---

## Environment Variables Reference

### Convex Default Variables (Preview + Dev)

Set these in Convex Dashboard → Settings → Default Environment Variables:

```bash
# Clerk Authentication
CLERK_JWT_ISSUER_DOMAIN=finer-llama-61.clerk.accounts.dev

# Optional: Add other common dev/preview variables
# OPENAI_API_KEY=sk-...
# GOOGLE_API_KEY=AIza...
# VOYAGE_API_KEY=pa-...
```

### Vercel Environment Variables

**Production Environment:**

```bash
CONVEX_DEPLOY_KEY=<production-deploy-key>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
GITHUB_OAUTH_CLIENT_ID=<production-oauth-id>
GITHUB_OAUTH_CLIENT_SECRET=<production-oauth-secret>
# ... other production secrets
```

**Preview Environment:**

```bash
CONVEX_DEPLOY_KEY=<preview-deploy-key>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
GITHUB_OAUTH_CLIENT_ID=<dev-oauth-id>
GITHUB_OAUTH_CLIENT_SECRET=<dev-oauth-secret>
# ... other dev/test secrets
```

**Note:** Many environment variables can be shared between Production and Preview. Use separate values when:

- Authentication providers require different credentials per environment
- API keys have environment-specific restrictions
- You want cost/usage isolation

---

## Clerk Multi-Environment Setup

### Current Setup (Development Instance)

You're currently using a Clerk **test** instance:

- Domain: `finer-llama-61.clerk.accounts.dev`
- Publishable Key: `pk_test_...`
- Secret Key: `sk_test_...`

### For Production

When ready for production:

1. **Create Production Instance:**
   - Clerk Dashboard → Create new Production instance
   - New domain: `your-app.clerk.accounts.dev` (or custom domain)

2. **Update Convex Production Variables:**

   ```bash
   CLERK_JWT_ISSUER_DOMAIN=your-app.clerk.accounts.dev
   ```

3. **Update Vercel Production Variables:**

   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   ```

4. **Configure OAuth:**
   - Production Clerk instance requires custom OAuth credentials
   - Register GitHub OAuth app for production
   - Add credentials to Clerk Dashboard

### For Preview Deployments

**Option 1: Share Dev Instance (Simpler)**

- Use same Clerk test instance for all previews
- Set as Convex default variable (recommended)

**Option 2: Separate Preview Instance (Advanced)**

- Create dedicated Clerk instance for previews
- Useful if you need isolation from dev environment
- More complex to set up

---

## Troubleshooting

### Preview Deployment Shows "Environment variable not set"

**Cause:** Convex default variables not configured.

**Fix:**

1. Verify Convex Dashboard → Default Environment Variables
2. Ensure variables are set for "Preview + Development"
3. Create new preview deployment to test

### Preview Deployment Not Created

**Cause:** Vercel not configured with preview deploy key.

**Fix:**

1. Check Vercel → Settings → Environment Variables
2. Ensure `CONVEX_DEPLOY_KEY` is set for **Preview** environment
3. Check Vercel build logs for errors

### Build Fails in CI After Removing Build Job

**Expected:** This is correct! CI should only run quality gates now.

**Action:** Remove `CONVEX_DEPLOY_KEY` from GitHub Secrets (no longer needed).

### Clerk Authentication Fails in Preview

**Cause:** Clerk instance doesn't allow preview URLs.

**Fix:**

1. Clerk Dashboard → Domains
2. Add preview domain pattern: `*.vercel.app` (for Vercel previews)
3. Or use Clerk development instance which allows all origins

---

## Best Practices

### DO ✅

- Use Convex default environment variables for shared config
- Let Vercel handle deployments when using Vercel hosting
- Keep CI focused on quality validation
- Use separate Clerk instances for prod vs dev/preview
- Document environment variable requirements

### DON'T ❌

- Don't duplicate deployment logic in CI and Vercel
- Don't commit `.vercel/` folder to git
- Don't use production credentials in preview deployments
- Don't manually create preview deployments (let Vercel automate)
- Don't forget to set default variables in Convex

---

## Migration Checklist

**Migrating from CI-managed to Vercel-managed deployments:**

- [ ] Configure Convex default environment variables
- [ ] Generate Convex preview deploy key
- [ ] Add Convex deploy keys to Vercel (production + preview)
- [ ] Verify Vercel build command
- [ ] Remove Build job from `.github/workflows/ci.yml`
- [ ] Remove `CONVEX_DEPLOY_KEY` from GitHub Secrets
- [ ] Update documentation (README, TODO)
- [ ] Test: Create PR → Verify preview deployment
- [ ] Test: Merge PR → Verify production deployment
- [ ] Monitor first few deployments for issues

---

## References

- [Convex Preview Deployments Docs](https://docs.convex.dev/production/hosting/preview-deployments)
- [Convex + Vercel Integration](https://docs.convex.dev/production/hosting/vercel)
- [Clerk Multi-Environment Setup](https://clerk.com/docs/deployments/overview)
- [Vercel Preview Deployments](https://vercel.com/docs/deployments/preview-deployments)

---

**Last Updated:** 2025-11-22
**Recommended Approach:** Approach A (Vercel-Managed)
