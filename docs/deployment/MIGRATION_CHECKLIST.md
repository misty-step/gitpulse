# Migration Checklist: CI-Managed → Vercel-Managed Deployments

This checklist ensures a smooth transition from CI-managed to Vercel-managed deployments.

**Time Required:** 20-30 minutes
**Downtime:** None (existing deployments continue working)

---

## Pre-Migration Checklist

Before starting, ensure you have:

- [ ] Access to Convex Dashboard (https://dashboard.convex.dev/)
- [ ] Access to Vercel Dashboard (https://vercel.com/dashboard)
- [ ] Access to GitHub repository settings
- [ ] Admin permissions on the repository

---

## Step 1: Configure Convex (5 minutes)

### 1.1 Set Default Environment Variables

**Why:** Preview deployments need automatic configuration

1. **Open Convex Dashboard:**
   - Go to https://dashboard.convex.dev/
   - Select `gitpulse` project
   - Settings → Environment Variables

2. **Add Default Variable:**
   - Look for "Default Environment Variables" section
   - Add for **Preview + Development** environments:
     ```
     CLERK_JWT_ISSUER_DOMAIN=finer-llama-61.clerk.accounts.dev
     ```
   - Click **Save**

**Verification:**
- [ ] Variable shows as applying to "Preview + Development"
- [ ] Variable NOT applied to Production

### 1.2 Generate Deploy Keys

1. **In Convex Dashboard:**
   - Settings → Deploy Keys

2. **Generate Keys:**
   - [ ] Click "Generate Production Deploy Key"
   - [ ] Copy production key (starts with `prod:...`)
   - [ ] Click "Generate Preview Deploy Key"
   - [ ] Copy preview key (starts with `preview:...`)

**Store keys securely** - you'll need them in Step 2.

---

## Step 2: Configure Vercel (10 minutes)

### 2.1 Add Convex Deploy Keys

1. **Open Vercel Dashboard:**
   - Go to https://vercel.com/dashboard
   - Select `gitpulse` project
   - Settings → Environment Variables

2. **Add Production Key:**
   - Click "Add New"
   - Name: `CONVEX_DEPLOY_KEY`
   - Value: `prod:...` (from Step 1.2)
   - Environments: ✅ **Production only**
   - Click "Save"

3. **Add Preview Key:**
   - Click "Add New"
   - Name: `CONVEX_DEPLOY_KEY`
   - Value: `preview:...` (from Step 1.2)
   - Environments: ✅ **Preview only**
   - Click "Save"

**Verification:**
- [ ] Two `CONVEX_DEPLOY_KEY` entries exist
- [ ] One for Production, one for Preview
- [ ] Values are different (prod vs preview keys)

### 2.2 Verify Build Settings

1. **In Vercel Dashboard:**
   - Settings → Build & Development Settings

2. **Check Settings:**
   - [ ] Build Command: `npx convex deploy --cmd 'pnpm build:app'`
   - [ ] Framework Preset: Next.js
   - [ ] Root Directory: `.`
   - [ ] Install Command: `pnpm install`

**Save** if any changes were made.

### 2.3 Verify Git Settings

1. **In Vercel Dashboard:**
   - Settings → Git

2. **Check Settings:**
   - [ ] Production Branch: `master`
   - [ ] Automatically deploy: ✅ Enabled
   - [ ] Preview Deployments: ✅ Enabled

---

## Step 3: Update GitHub Repository (5 minutes)

### 3.1 Remove Build Job from CI

**Status:** ✅ Already completed
- Build job removed from `.github/workflows/ci.yml`
- CI now runs quality gates only (typecheck, lint, test, security)

### 3.2 Remove GitHub Secret

**Why:** CI no longer deploys, so doesn't need the deploy key

```bash
# Remove the secret
gh secret remove CONVEX_DEPLOY_KEY

# Verify removal
gh secret list
# Should NOT show CONVEX_DEPLOY_KEY
```

**Verification:**
- [ ] `gh secret list` shows no `CONVEX_DEPLOY_KEY`
- [ ] Secret successfully removed

**Alternative (via GitHub UI):**
1. Go to repository Settings → Secrets and variables → Actions
2. Find `CONVEX_DEPLOY_KEY`
3. Click "Remove"
4. Confirm deletion

---

## Step 4: Test Preview Deployment (5-10 minutes)

### 4.1 Create Test Branch

```bash
cd /Users/phaedrus/Development/gitpulse
git checkout -b test/vercel-preview-deployment
```

### 4.2 Make Test Change

```bash
echo "# Vercel Preview Test" >> docs/deployment/TEST_PREVIEW.md
git add docs/deployment/TEST_PREVIEW.md
git commit -m "test: verify Vercel preview deployment configuration"
git push -u origin test/vercel-preview-deployment
```

### 4.3 Create Pull Request

```bash
gh pr create \
  --title "test: Verify Vercel preview deployment" \
  --body "Testing Vercel-managed preview deployments. See \`docs/deployment/VERCEL_SETUP.md\` for setup details." \
  --base master
```

### 4.4 Monitor Deployment

1. **Check Vercel Dashboard:**
   - Go to Deployments tab
   - Look for deployment of `test/vercel-preview-deployment` branch
   - Status should progress: Queued → Building → Ready

2. **Check Convex Dashboard:**
   - Go to Deployments
   - Look for new preview deployment (e.g., `test-vercel-preview-deployment`)
   - Click to view details
   - Check Environment Variables tab for `CLERK_JWT_ISSUER_DOMAIN`

3. **Check GitHub PR:**
   - Vercel bot should comment with preview URL
   - GitHub Actions should show quality gates passing

**Verification:**
- [ ] Vercel deployment completes successfully
- [ ] Convex preview deployment created
- [ ] Preview deployment has `CLERK_JWT_ISSUER_DOMAIN` set
- [ ] Vercel bot commented on PR with preview URL
- [ ] GitHub Actions CI passes (quality gates only)

### 4.5 Test Preview Site

1. **Click preview URL** from Vercel comment
2. **Test functionality:**
   - [ ] Site loads without errors
   - [ ] Can navigate to pages
   - [ ] Sign in works (Clerk authentication)
   - [ ] Dashboard accessible
   - [ ] No console errors

**Success Criteria:**
- ✅ All tests pass
- ✅ No environment variable errors
- ✅ Clerk authentication works
- ✅ Convex connection successful

---

## Step 5: Test Production Deployment (5 minutes)

### 5.1 Merge Test PR

If preview deployment worked correctly:

```bash
# Merge the test PR
gh pr merge test/vercel-preview-deployment --squash --delete-branch

# Pull latest master
git checkout master
git pull
```

### 5.2 Monitor Production Deployment

1. **Check Vercel Dashboard:**
   - Deployments tab
   - Look for new **Production** deployment
   - Should deploy automatically after merge

2. **Check Convex Dashboard:**
   - Production deployment should be updated
   - Check logs for any errors

3. **Verify Production Site:**
   - Visit production URL
   - Test authentication
   - Verify core functionality

**Verification:**
- [ ] Production deployment completes
- [ ] No errors in Vercel logs
- [ ] No errors in Convex logs
- [ ] Production site works correctly

---

## Step 6: Clean Up (2 minutes)

### 6.1 Remove Test Files (Optional)

```bash
git checkout master
rm docs/deployment/TEST_PREVIEW.md
git add docs/deployment/TEST_PREVIEW.md
git commit -m "chore: remove test deployment file"
git push
```

### 6.2 Update Documentation

**Status:** ✅ Already completed
- README.md updated with Vercel-managed deployment workflow
- Comprehensive guides created in `docs/deployment/`

---

## Rollback Plan

If issues arise, you can rollback:

### Restore CI Deployments

1. **Add back Build job to `.github/workflows/ci.yml`:**
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
           node-version: '22'
           cache: 'pnpm'
       - name: Install dependencies
         run: pnpm install --frozen-lockfile
       - name: Deploy Convex
         run: npx convex deploy --cmd 'pnpm build:app'
         env:
           CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
   ```

2. **Re-add GitHub secret:**
   ```bash
   # Add preview deploy key back to GitHub
   gh secret set CONVEX_DEPLOY_KEY
   # Paste the preview deploy key when prompted
   ```

3. **Disable Vercel auto-deploy (optional):**
   - Vercel → Settings → Git
   - Disable "Automatically deploy"

---

## Post-Migration Checklist

After migration is complete:

- [ ] Convex default environment variables configured
- [ ] Vercel deploy keys configured (production + preview)
- [ ] Vercel build command verified
- [ ] GitHub secret removed
- [ ] Test preview deployment successful
- [ ] Test production deployment successful
- [ ] Documentation updated
- [ ] Team notified of new deployment process

---

## Monitoring (First 48 Hours)

### What to Watch

1. **Deployment Speed:**
   - Preview deployments should complete in 2-5 minutes
   - Production deployments should complete in 3-7 minutes

2. **Error Rates:**
   - Check Vercel logs for build errors
   - Check Convex logs for runtime errors
   - Monitor Sentry for frontend errors

3. **Environment Variables:**
   - Verify all preview deployments have required variables
   - Check for any "variable not set" errors

### Common Issues

**Issue:** Preview deployment fails with missing env var
**Solution:** Check Convex default environment variables are set correctly

**Issue:** Production deployment fails
**Solution:** Verify Convex production deploy key is set in Vercel Production environment

**Issue:** Clerk authentication fails in preview
**Solution:** Check Clerk Dashboard → Domains allows `*.vercel.app`

---

## Support Resources

- **Deployment Guide:** `docs/deployment/PREVIEW_DEPLOYMENTS_GUIDE.md`
- **Vercel Setup:** `docs/deployment/VERCEL_SETUP.md`
- **Quick Start:** `docs/deployment/QUICK_START.md`
- **Convex Docs:** https://docs.convex.dev/production/hosting/preview-deployments
- **Vercel Docs:** https://vercel.com/docs/deployments/preview-deployments

---

## Summary

**Before Migration:**
```
GitHub PR → GitHub Actions → Convex Deploy → Build
                ↓
         ❌ Fails on preview env vars
```

**After Migration:**
```
GitHub PR → Vercel → Convex Deploy → Build → Preview URL ✅
          ↓
GitHub Actions → Quality Gates Only ✅
```

**Key Changes:**
- ✅ Vercel handles all deployments
- ✅ CI runs quality validation only
- ✅ Preview deployments automatic for PRs
- ✅ Cleaner separation of concerns

---

**Migration Status:** Ready to proceed
**Estimated Time:** 20-30 minutes
**Risk Level:** Low (can rollback easily)
