# TODO - infrastructure/production-hardening

Branch focus: keep Vercel/Convex deploys green and prevent config drift.

Current state (2025-11-23):
- Build pipeline fixed: `vercel.json` runs `npx convex deploy --cmd 'pnpm build:app'`; `pnpm build` now aliases the pure Next.js build.
- Vercel preview env is populated (Convex deploy key, Clerk publishable/secret/issuer + auth URLs, GitHub app install URL, lefthook disabled). Latest preview deploy succeeded: https://gitpulse-m24tv9os5-adminifi.vercel.app
- Production Convex deploy key set, but production Clerk env not yet populated.
- CLAUDE code-review action still missing `CLAUDE_CODE_OAUTH_TOKEN`.

## Done
- Updated build scripts to avoid double Convex deploys (`build:app`, `build` alias).
- Switched Vercel build command to use `build:app`.
- Guarded `prepare` script to skip lefthook when `.git` is absent.
- Set Convex deploy keys in Vercel (preview + production).
- Set required Clerk + GitHub public env vars in Vercel preview.
- Ran successful preview deploy.
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
