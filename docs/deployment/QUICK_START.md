# Quick Start: Fix CI Build Failure

**Problem:** CI failing with missing `CLERK_JWT_ISSUER_DOMAIN` environment variable

**Solution:** Set Convex default environment variables (5 minutes)

---

## Immediate Fix (Works for Any Approach)

### Step 1: Set Convex Default Environment Variables

1. **Open Convex Dashboard:**
   - Go to https://dashboard.convex.dev/
   - Select the `gitpulse` project
   - Click **Settings** in the sidebar
   - Click **Environment Variables**

2. **Add Default Variables:**
   - Look for **"Default Environment Variables"** or **"Set Default Variables"** section
   - Click to add variables that apply to **Preview + Development** deployments
   - Add:
     ```
     Variable Name: CLERK_JWT_ISSUER_DOMAIN
     Value: finer-llama-61.clerk.accounts.dev
     Environments: Preview, Development (NOT Production - it has its own)
     ```

3. **Save Changes**

4. **Trigger New CI Run:**
   ```bash
   # Option 1: Rerun existing workflow
   gh run rerun 19588412912

   # Option 2: Push trivial commit
   git commit --allow-empty -m "fix(ci): trigger CI after Convex env var setup"
   git push
   ```

**Expected Result:** Build job should now pass.

---

## Choose Your Long-Term Approach

### Option A: Vercel-Managed Deployments (RECOMMENDED)

**What:** Remove build from CI, let Vercel handle deployments

**Why:**
- ✅ Official Convex best practice
- ✅ Automatic preview deployments for PRs
- ✅ Simpler setup

**Next Steps:**
1. Configure Vercel with Convex deploy keys (see full guide)
2. Remove Build job from `.github/workflows/ci.yml`
3. Test with new PR

**See:** [PREVIEW_DEPLOYMENTS_GUIDE.md](./PREVIEW_DEPLOYMENTS_GUIDE.md#-approach-a-vercel-managed-deployments-recommended)

---

### Option B: CI-Managed Deployments (Current Approach)

**What:** Keep CI in control, only build master branch

**Why:**
- ✅ More control over deployment
- ❌ No preview deployments for PRs
- ❌ More complex

**Next Steps:**
1. Restrict Build job to master branch only:
   ```yaml
   build:
     if: github.ref == 'refs/heads/master'
   ```

**See:** [PREVIEW_DEPLOYMENTS_GUIDE.md](./PREVIEW_DEPLOYMENTS_GUIDE.md#approach-b-ci-managed-deployments)

---

## Verification

After applying the fix:

```bash
# Check Convex default variables
# (Open Convex Dashboard → Settings → Environment Variables → Defaults)

# Rerun CI
gh run rerun 19588412912

# Watch CI progress
gh run watch

# Check status
gh pr checks
```

**Success Criteria:**
- ✅ Build job passes
- ✅ No "environment variable not set" error
- ✅ Convex deploys successfully

---

## Need Help?

- Full documentation: [PREVIEW_DEPLOYMENTS_GUIDE.md](./PREVIEW_DEPLOYMENTS_GUIDE.md)
- Convex docs: https://docs.convex.dev/production/hosting/preview-deployments
- Vercel docs: https://vercel.com/docs/deployments/preview-deployments

---

**TLDR:** Set `CLERK_JWT_ISSUER_DOMAIN=finer-llama-61.clerk.accounts.dev` as a Convex default environment variable for Preview + Development environments.
