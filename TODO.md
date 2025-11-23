# TODO - infrastructure/production-hardening

Branch focus: keep Vercel/Convex deploys green and prevent config drift.

Current state (2025-11-23):
- Build pipeline fixed: `vercel.json` runs `npx convex deploy --cmd 'pnpm build:app'`; `pnpm build` now aliases the pure Next.js build.
- **FIXED**: Vercel `CONVEX_DEPLOY_KEY` had literal `\n` suffix causing CLI to reject key. Removed using `printf` (no trailing newline) when setting via Vercel CLI.
- Latest successful preview deploy: https://gitpulse-n9i639l1w-adminifi.vercel.app (verified Convex deployment works)
- Production Convex deploy key fixed (same `\n` issue)
- Production Clerk env not yet populated
- CLAUDE code-review action still missing `CLAUDE_CODE_OAUTH_TOKEN`.

## Done
- Updated build scripts to avoid double Convex deploys (`build:app`, `build` alias).
- Switched Vercel build command to use `build:app`.
- Guarded `prepare` script to skip lefthook when `.git` is absent.
- Set Convex deploy keys in Vercel (preview + production).
- **Fixed Convex deploy key corruption**: Removed literal `\n` suffix from both Preview and Production `CONVEX_DEPLOY_KEY` environment variables.
- Set required Clerk + GitHub public env vars in Vercel preview.
- Ran successful preview deploy (https://gitpulse-n9i639l1w-adminifi.vercel.app).
- Added `build:local` script for local one-shot builds.
- Created deployment config preflight script and wired into CI.
- Enabled build check in pre-push hook with `SKIP_BUILD_CHECK` escape hatch.
- Silenced Turbopack warnings by adding dev deps.

## In Progress / Blockers
- Populate production Clerk secrets (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, auth URLs) in Vercel.
- Add `CLAUDE_CODE_OAUTH_TOKEN` GitHub secret so `claude-code-review` stops failing.

## Next Actions (short horizon)
- [ ] Populate production Clerk vars in Vercel; run `vercel --prod` smoke deploy.
- [ ] Add `CLAUDE_CODE_OAUTH_TOKEN` to GitHub secrets; rerun `claude-code-review` workflow.

## Verification targets
- Preview deploys green with Convex + Clerk wiring.
- Production deploy succeeds with Clerk prod keys.
- CI gate fails fast on missing deploy keys / Clerk env.
- Pre-push hook blocks broken builds (with documented bypass).

Last updated: 2025-11-23
