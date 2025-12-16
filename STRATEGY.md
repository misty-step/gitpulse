# STRATEGY

Strategic guidelines and north stars for GitPulse.

Last updated: 2025-12-13 (consultant audit synthesis)

---

## Positioning

"GitPulse is the AI standup that links every claim back to the exact PR/commit."

**Category**: High-Trust AI Reporting (between standup bots and enterprise analytics)

**Differentiation**: Citation-backed reports with coverage scoring

---

## North Star Metric

**Weekly Trusted Reports Consumed**
- Reports generated successfully
- With `coverageScore` >= 0.7
- Opened/clicked (Slack/email)

**Supporting Metrics**:
- Activation: OAuth -> Install -> First report within 10min
- Retention: Weekly active recipients, scheduler enabled
- Quality: Median coverage score, staleness rate

---

## ICP (Primary)

**Tech Lead** in 3-20 person team:
- Async/distributed work
- Hates writing standups
- Needs "what did I do?" with accuracy
- Shares reports with stakeholders

---

## Ingestion Strategy: Path A (Commit-First)

**Decision**: Ship reliable commit-based standups first.

**Why**:
- Simpler to stabilize (one GitHub API surface)
- Easier to explain: "We summarize your commits, with links"
- Current SyncService overhaul aligns with this

**Future**: Add PR/review ingestion after commit loop is rock-solid.

---

## Pricing Model

- **Free**: 1 user, 3 repos, daily reports only
- **Pro ($15/mo)**: Unlimited repos, daily+weekly, Slack/email
- **Team ($40/user/mo)**: Workspaces, team digests

---

## GTM Channels

1. **GitHub Marketplace** — App listing (natural discovery)
2. **Content/SEO** — "daily standup template", "async engineering updates"
3. **Slack virality** — Report posted -> teammates click -> new installs
4. **Founder-led outbound** — Remote-first eng teams (5-50 devs)

---

## Moats to Build

1. **Trust moat**: Coverage scoring + citations = "if we can't cite it, we won't say it"
2. **Data moat**: Historical digest archive + searchable memory
3. **Workflow moat**: Slack/email habits + team workflows

---

## Anti-Goals

- Full DORA dashboard (not our wedge)
- Multi-integration sprawl before GitHub is solid
- Enterprise SSO/SOC2 before PLG proven
