# Project: GitPulse

## Vision
Intelligent agent over git history — understands activity across orgs, repos, time, and contributors. Surfaces insights you didn't know to ask for.

**North Star:** An agent that knows your engineering organization better than any individual does — who knows what, where the risks are, what's stalled, what shipped, and what to do next.
**Target User:** Individual contributors and engineering leaders who want intelligence, not dashboards.
**Current Focus:** Build the agentic foundation — expand toolbox, enrich data, make the CLI feel intelligent.
**Key Differentiators:**
1. Citation-backed trust — every claim links to verifiable source
2. Proactive insights — bus factor, bottlenecks, anomalies, not just counts
3. CLI/TUI first — works where developers work
4. Deterministic metrics with optional LLM narrative — degrades gracefully

## Domain Glossary

| Term | Definition |
|------|-----------|
| Activity Event | A single git event: commit, PR opened/merged, review, issue opened/closed |
| Activity Window | A time range (from/to) bounding a query |
| Scope | The set of repos, orgs, and contributors being analyzed |
| Tool | A function the agent can call to fetch/compute data (Vercel AI SDK pattern) |
| Block | A typed UI component (metric grid, event feed, repo breakdown, insight list) |
| Citation | A link to a specific GitHub artifact backing a claim |
| Deterministic Mode | Agent operates without LLM — metrics and insights computed from data only |
| Bus Factor | Number of contributors who must leave before a repo loses all expertise |

## Active Focus

- **Milestone:** v2: Agentic Foundation
- **Key Issues:** #174 (legacy purge), #175 (toolbox expansion), #176 (data enrichment), #177 (natural time), #178 (local repo detection)
- **Theme:** Make the agent genuinely intelligent — more tools, richer data, CLI that feels natural

## Quality Bar

- [ ] Every quantitative claim is computed deterministically from tool data, never from LLM
- [ ] `bun run typecheck && bun run test && bun run build` passes
- [ ] Agent works in deterministic mode (no OPENROUTER_API_KEY) with useful output
- [ ] CLI requires zero flags for basic queries when run inside a git repo

## Patterns to Follow

### Tool Registration
```typescript
// packages/agent-core/src/agent.ts — follow this pattern for new tools
get_activity_window: tool({
  description: "Concise description for LLM context",
  inputSchema: z.object({ /* Zod schema */ }),
  execute: async (args) => { /* implementation */ },
}),
```

### Event Processing
```typescript
// Fetch from GitHub → normalize to ActivityEvent → compute metrics deterministically
const events = await fetchRepoEvents(repo, window, token);
const metrics = computeMetrics(events);
// LLM sees metrics + events but never produces metrics
```

## Lessons Learned

| Decision | Outcome | Lesson |
|----------|---------|--------|
| Convex + Clerk + cron-based sync | Rebuilt from scratch | Agentic pull > scheduled push. Fetch on demand, not on schedule. |
| Web-first with dashboard | Low usage | CLI-first for developer tools. Web is a secondary surface. |
| 2 agent tools | Agent feels dumb | More tools = smarter agent. The LLM is capable; starve it of data access and it can't help. |

---
*Last updated: 2026-03-07*
*Updated during: /groom session*
