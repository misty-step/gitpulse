# CI Failure Analysis

**Workflow**: CI → Build Job
**Run ID**: 19588412912
**Classification**: **Configuration Issue**
**Status**: ACTIONABLE - Fix Required

---

## Error Summary

```
✖ Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not set.
Go to:
    https://dashboard.convex.dev/settings/environment-variables?var=CLERK_JWT_ISSUER_DOMAIN
  to set it up.
```

**Exit Code**: 1
**Failed Step**: Deploy Convex
**Command**: `npx convex deploy --cmd 'pnpm build'`

---

## Root Cause

**Type**: Preview Deployment Configuration Issue
**Location**: `convex/auth.config.ts:6`

The Convex auth configuration requires `CLERK_JWT_ISSUER_DOMAIN` environment variable:

```typescript
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, // ❌ Not set in preview deployments
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

**Why It Failed**:
- ✅ Works locally: `.env.local` loaded by Next.js dev server
- ✅ Works in dev deployment: Variable set in Convex development environment
- ❌ Fails in CI: Deploys to Convex **preview deployment** (hardy-bobcat-281) which is isolated
- Preview deployments don't inherit variables from dev or production environments

**What's Happening**:
- CI uses `CONVEX_DEPLOY_KEY` secret to deploy
- This key creates **preview deployments** (separate Convex instance per branch)
- Preview deployments are isolated and need their own environment configuration
- Variable is set in **dev** environment but not in **preview** environments

---

## Resolution

### Quick Fix (5 minutes)

Set Convex **Default Environment Variables** for preview deployments:

1. **Go to Convex Dashboard:**
   - https://dashboard.convex.dev/
   - Select `gitpulse` project
   - Settings → Environment Variables

2. **Add Default Variable:**
   - Look for "Default Environment Variables" or "Set Default Variables"
   - Add variable for **Preview + Development** environments:
     ```
     CLERK_JWT_ISSUER_DOMAIN=finer-llama-61.clerk.accounts.dev
     ```
   - Save

3. **Trigger CI Rerun:**
   ```bash
   gh run rerun 19588412912
   # OR
   git commit --allow-empty -m "fix(ci): trigger after Convex env setup"
   git push
   ```

**Why This Works:**
- Default environment variables apply to ALL preview and development deployments
- No need to set variables for each individual preview deployment
- Future preview deployments automatically receive these variables

### Long-Term: Choose Deployment Strategy

See detailed guide: `docs/deployment/PREVIEW_DEPLOYMENTS_GUIDE.md`

**Option A: Vercel-Managed (Recommended)**
- Remove Build job from CI
- Let Vercel handle deployments
- CI only runs quality gates

**Option B: CI-Managed (Current)**
- Keep Build job
- Restrict to master branch only
- No preview deployments for PRs

---

## Verification

After the fix:
- [ ] Convex deploy succeeds without environment variable error
- [ ] Next.js build completes
- [ ] Build job passes in CI
- [ ] All quality gates remain green

**Expected Timeline**: 5-10 minutes (2 min setup + 3-8 min CI run)

---

## Secondary Failure: Claude Code Review

**Workflow**: Claude Code Review
**Run ID**: 19588412908
**Classification**: Infrastructure Issue (Non-Blocking)
**Status**: INFORMATIONAL - No Action Required

**Cause**: Large PR (38 commits, 64 files, +6493/-1157 lines) likely exceeded:
- Claude API token limits
- Action timeout (30s observed, workflow incomplete)

**Impact**: None - this is an optional review workflow, not a merge blocker

**Recommendation**: Ignore for now, or consider breaking future PRs into smaller chunks

---

## Prevention

### Immediate
- Document all required environment variables in README.md
- Add environment variable validation to CI setup step
- Create `.env.example` template

### Long-term
- Use `t3-env` or similar for type-safe environment variable validation
- Add pre-flight checks in CI to validate required vars before running expensive builds
- Consider Convex environment variable syncing tool

---

## Related Files

- `convex/auth.config.ts:6` - Usage of missing variable
- `.env.local` - Local environment (needs update)
- `.github/workflows/ci.yml` - CI configuration
- Convex Dashboard - Production environment variables

---

*Generated: 2025-11-22T01:58:00Z*
*Analyzer: CI Specialist*
