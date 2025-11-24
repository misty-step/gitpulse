---
"gitpulse": minor
---

Redesigned footer with improved brand consistency and automated versioning infrastructure

- Fixed brand casing: "A Misty Step Project" and "© 2025 Misty Step LLC" (Title Case)
- Changed legal entity from Inc. to LLC
- Added copy-to-clipboard interaction for support email (no longer exposes email directly)
- Removed version number display from footer (will be re-added when automated releases are active)
- Removed system status section from footer (logical fallacy: badge wouldn't be visible if system down)
- Simplified footer to clean 2-column layout (brand + navigation)
- Wired hero metadata to real data: version from package.json, status from /api/health, latency from actual API call
- Created HeroMetadata component with loading states and health status indicators
- Implemented Changesets automation for versioning and changelog generation
- Added GitHub Action for automated "Version Packages" PR creation
- Documented changeset workflow in CONTRIBUTING.md
