# Vercel Setup Guide: Step-by-Step

This guide walks you through configuring Vercel for automatic deployments with Convex and Clerk.

**Time Required:** 15-20 minutes

---

## Prerequisites

- ✅ Vercel project already created (project ID: `prj_GDsWOgc4tdR4FNyBwFMDEY49vOa6`)
- ✅ GitHub repository connected to Vercel
- ✅ Convex project created (development environment set up)
- ✅ Clerk account with test instance configured

---

## Step 1: Generate Convex Deploy Keys

### 1.1 Production Deploy Key

1. **Open Convex Dashboard:**
   - Go to https://dashboard.convex.dev/
   - Select the `gitpulse` project
   - Navigate to **Settings** → **Deploy Keys**

2. **Generate Production Key:**
   - Click **"Generate Production Deploy Key"**
   - Copy the key (starts with `prod:...`)
   - Keep this window open or save to a secure location

### 1.2 Preview Deploy Key

1. **In the same Deploy Keys section:**
   - Click **"Generate Preview Deploy Key"**
   - Copy the key (starts with `preview:...`)
   - Keep this secure

**Important:** You'll need both keys in the next step.

---

## Step 2: Configure Convex Default Environment Variables

This ensures ALL preview deployments automatically receive the required configuration.

1. **In Convex Dashboard:**
   - Settings → **Environment Variables**
   - Look for **"Default Environment Variables"** or **"Set Default Variables"** section

2. **Add Default Variables:**
   - Click to configure variables for **Preview + Development** environments
   - Add the following:

   ```bash
   # Required: Clerk JWT Issuer Domain
   CLERK_JWT_ISSUER_DOMAIN=finer-llama-61.clerk.accounts.dev
   ```

3. **Save Changes**

**Verification:**
- The variable should show as applying to "Preview + Development" environments
- It should NOT be set for Production (production will use its own value later)

---

## Step 3: Configure Vercel Environment Variables

### 3.1 Add Convex Deploy Keys

1. **Open Vercel Dashboard:**
   - Go to https://vercel.com/dashboard
   - Select the `gitpulse` project
   - Navigate to **Settings** → **Environment Variables**

2. **Add Production Deploy Key:**
   ```
   Variable Name: CONVEX_DEPLOY_KEY
   Value: prod:... (paste your production deploy key from Step 1.1)
   Environments: ✅ Production ONLY
   ```
   - Click **Save**

3. **Add Preview Deploy Key:**
   ```
   Variable Name: CONVEX_DEPLOY_KEY
   Value: preview:... (paste your preview deploy key from Step 1.2)
   Environments: ✅ Preview ONLY
   ```
   - Click **Save**

**Result:** You should now have TWO `CONVEX_DEPLOY_KEY` entries:
- One for Production
- One for Preview

### 3.2 Verify Existing Environment Variables

Ensure these are already configured (they should be from initial setup):

**Production Environment:**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
# Plus any other production-specific variables
```

**Preview Environment:**
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
# Plus any other preview-specific variables
```

**Note:** For now, you can use the same Clerk test instance for both. When moving to production, you'll create a separate Clerk production instance with `pk_live_...` keys.

---

## Step 4: Configure Vercel Build Settings

1. **In Vercel Dashboard:**
   - Settings → **Build & Development Settings**

2. **Verify/Set Build Command:**
   ```bash
   npx convex deploy --cmd 'pnpm build:app'
   ```

3. **Verify Framework Preset:**
   - Should be: **Next.js**

4. **Verify Root Directory:**
   - Should be: `.` (project root)

5. **Verify Install Command:**
   - Should be: `pnpm install`

**Save** if you made any changes.

---

## Step 5: Configure Git Integration

1. **In Vercel Dashboard:**
   - Settings → **Git**

2. **Verify Settings:**
   - ✅ **Production Branch:** `master`
   - ✅ **Automatically deploy:** Enabled for production branch
   - ✅ **Preview Deployments:** Enabled for all branches

3. **Ignored Build Step (Optional but Recommended):**

   To skip building if only docs changed, add to your project root:

   ```bash
   # vercel.json (optional)
   {
     "git": {
       "deploymentEnabled": {
         "docs/**": false,
         "*.md": false
       }
     }
   }
   ```

---

## Step 6: Test Preview Deployment

Let's verify everything works before finalizing.

### 6.1 Create Test Branch

```bash
cd /Users/phaedrus/Development/gitpulse
git checkout -b test/vercel-deployment
```

### 6.2 Make Trivial Change

```bash
echo "# Test Vercel Deployment" >> docs/deployment/TEST.md
git add docs/deployment/TEST.md
git commit -m "test: verify Vercel preview deployment"
git push -u origin test/vercel-deployment
```

### 6.3 Create Pull Request

```bash
gh pr create \
  --title "test: Verify Vercel preview deployment" \
  --body "Testing Vercel-managed preview deployments after CI refactor." \
  --base master
```

### 6.4 Monitor Deployment

1. **Check Vercel Dashboard:**
   - Go to Deployments
   - You should see a new deployment for `test/vercel-deployment` branch
   - Status should progress: Queued → Building → Deploying → Ready

2. **Check Convex Dashboard:**
   - Go to Deployments
   - You should see a new preview deployment (e.g., `test-vercel-deployment` or similar)
   - Verify it has `CLERK_JWT_ISSUER_DOMAIN` set (check environment variables)

3. **Check GitHub PR:**
   - Vercel bot should comment with preview URL
   - Click the preview URL to test the deployment

### 6.5 Verify Preview Works

1. **Open Preview URL** (from Vercel comment)
2. **Test Key Functionality:**
   - Site loads without errors
   - Sign in works (Clerk authentication)
   - Can navigate to dashboard
   - No console errors related to Convex or Clerk

3. **Check Browser Console:**
   - Should see Convex connection logs
   - No authentication errors

**Success Criteria:**
- ✅ Vercel deployment completes successfully
- ✅ Preview site loads and works
- ✅ Clerk authentication works
- ✅ Convex backend is accessible
- ✅ No environment variable errors in logs

---

## Step 7: Test Production Deployment

### 7.1 Merge Test PR

If the preview deployment worked:

```bash
# Merge the test PR
gh pr merge --squash

# Pull latest master
git checkout master
git pull
```

### 7.2 Monitor Production Deployment

1. **Check Vercel Dashboard:**
   - Go to Deployments
   - You should see a new **Production** deployment for `master` branch
   - Status should progress to Ready

2. **Check Convex Dashboard:**
   - Production deployment should be updated
   - Verify no errors in logs

3. **Verify Production Site:**
   - Visit your production URL
   - Test authentication
   - Verify core functionality

**Success Criteria:**
- ✅ Production deployment completes
- ✅ Production site works correctly
- ✅ No regressions

---

## Step 8: Clean Up GitHub Secrets

Now that Vercel handles deployments, the GitHub CI no longer needs the Convex deploy key.

### 8.1 Remove Secret

```bash
gh secret remove CONVEX_DEPLOY_KEY
```

**Verify:**
```bash
gh secret list
# Should NOT show CONVEX_DEPLOY_KEY
```

### 8.2 Update Documentation

The secret removal is already documented in:
- `docs/deployment/PREVIEW_DEPLOYMENTS_GUIDE.md`
- This file

---

## Step 9: Monitor First Few Deployments

For the next 2-3 PRs, keep an eye on:

1. **Deployment Speed:**
   - Preview deployments should complete in 2-5 minutes
   - Check Vercel build logs if taking longer

2. **Environment Variables:**
   - Verify preview deployments have all required variables
   - Check Convex logs for any "variable not set" errors

3. **Clerk Authentication:**
   - Verify both preview and production auth work correctly
   - Check for any CORS or domain issues

4. **Convex Functions:**
   - Test that Convex functions work in preview deployments
   - Verify data isolation between preview and production

---

## Troubleshooting

### Preview Deployment Fails with "CLERK_JWT_ISSUER_DOMAIN not set"

**Solution:**
1. Check Convex Dashboard → Environment Variables → Defaults
2. Verify variable is set for **Preview + Development**
3. Create new preview deployment to test

### Vercel Build Fails

**Check:**
1. Vercel build logs for specific error
2. Build command is correct: `npx convex deploy --cmd 'pnpm build:app'`
3. `CONVEX_DEPLOY_KEY` is set for the correct environment

### Preview Deployment Works but Production Fails

**Cause:** Different environment variable configuration

**Solution:**
1. Check production environment variables in Vercel
2. Ensure production has all required variables
3. Check Convex production environment variables

### Clerk Authentication Fails

**Check:**
1. Clerk Dashboard → Domains
2. Ensure preview domain pattern is allowed: `*.vercel.app`
3. Verify Clerk keys are correct in Vercel environment variables

---

## Next Steps After Setup

1. **Update Documentation:**
   - README.md should reflect new deployment workflow
   - CONTRIBUTING.md should mention Vercel previews

2. **Monitor Costs:**
   - Track Convex usage (preview deployments count toward quota)
   - Set up billing alerts in Convex dashboard

3. **Set Up Alerts:**
   - Configure Vercel deployment notifications (Slack/Discord)
   - Set up Convex monitoring for preview deployments

4. **Production Readiness:**
   - When ready for production Clerk instance, follow production setup guide
   - Update Convex production environment variables accordingly

---

## Summary Checklist

After completing this guide, you should have:

- ✅ Convex production deploy key configured in Vercel production environment
- ✅ Convex preview deploy key configured in Vercel preview environment
- ✅ Convex default environment variables set for previews
- ✅ Vercel build command configured
- ✅ Test preview deployment successful
- ✅ Test production deployment successful
- ✅ GitHub secret removed
- ✅ Documentation updated

**Deployment Flow:**
```
PR Created → Vercel Detects → Creates Preview Deployment
  ↓
Vercel Runs: npx convex deploy --cmd 'pnpm build:app'
  ↓
Convex Creates: Preview backend (with default env vars)
  ↓
Next.js Build: Connects to preview Convex backend
  ↓
Vercel Deploys: Preview URL ready
  ↓
PR Comment: Vercel bot posts preview URL
```

**Merge to Master:**
```
PR Merged → Vercel Detects → Deploys to Production
  ↓
Same process but using production Convex deployment
```

---

## Support

- **Vercel Issues:** https://vercel.com/help
- **Convex Issues:** https://convex.dev/community
- **Internal Docs:** `docs/deployment/PREVIEW_DEPLOYMENTS_GUIDE.md`

---

**Last Updated:** 2025-11-22
**Setup Time:** 15-20 minutes
**Estimated First Deploy:** 2-5 minutes
