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

---

## Competitive Intelligence (Gemini Analysis 2025-11-29)

**Market Position**: GitPulse occupies unique "High-Trust Niche"
- Enterprise tools (LinearB/Waydev/Jellyfish): Focus on DORA metrics, suffer "big brother" perception
- AI Assistants (Spinach/Standuply): Automation but shallow/hallucination-prone
- **GitPulse Advantage**: RAG + Citation Verification = "Proof of work" tool

**Key Competitor Moves (2025)**:
- LinearB: Launching "Model Context Protocol" for natural language queries
- Waydev: Rebranding as "AI-native" with "AI Coach"
- GitClear: Positioning against AI, publishing anti-AI research

**Strategic Recommendations**:
1. Double down on citations - this is the moat
2. Attack the "Black Box" - market transparency vs competitors
3. Leverage content addressing for "Zero Duplication" reports

---

## Learnings

**From architectural audit (2025-12-09):**
- **Council verdict: KEEP** — 7.6/10 average score from 7 master perspectives
- **Deep modules working** — syncPolicy.ts, syncService.ts, canonicalFactService.ts, githubApp.ts exemplify Ousterhout's principles
- **canonicalizeEvent.ts complexity debt** — 1,159 lines, largest file, needs extraction
- **LLMClient abstraction violation** — generateReport.ts bypasses existing abstraction
- **Cron job explosion** — 192 jobs approaching 50% of Convex soft limit
- **Scaling path clear** — production-ready for 0-100k events, add vector DB at 500k

**From grooming session (2025-11-29):**
- **Event type mismatch** — `"review"` vs `"review_submitted"` causes silent KPI gaps
- **KPI query O(n)** — Convex indexes support range filtering but code fetches full table
- **Console.log leakage** — 18 occurrences despite Pino installed
- **Lefthook gap** — Package installed but config file never created

**From consultant audit (2025-12-13):**
- **Dual ingestion confirmed** — `syncJobs/syncBatches` + `ingestionJobs` both active
- **Weekly cron legacy** — Uses deprecated schedule fields; migration to `midnightUtcHour` needed
- **Path A chosen** — Commit-first ingestion; PR/review deferred until commit loop stable
- **Trust is the moat** — Citation-backed reporting differentiates from competitors
- **OAuth scope drag** — Broad scopes hurt adoption; minimize to `repo,read:user`

**Cross-validation signals (15 perspectives converged):**
- Performance + Ousterhout + Carmack → N+1 patterns as critical
- Security + Maintainability → Console.log cleanup
- Product + Jobs + UX → Citation drawer as high-value enhancement
- Beck + Architecture-guardian → Test infrastructure gaps
- Grug + Carmack + Jobs → Report orchestrator needs simplification
