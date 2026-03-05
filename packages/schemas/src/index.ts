import { z } from "zod";

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const TimeWindowSchema = z
  .object({
    from: IsoDateTimeSchema,
    to: IsoDateTimeSchema,
  })
  .refine((value) => Date.parse(value.from) <= Date.parse(value.to), {
    message: "from must be <= to",
    path: ["from"],
  });

export const ScopeSchema = z.object({
  repos: z.array(z.string().min(1)).default([]),
  orgs: z.array(z.string().min(1)).default([]),
  contributors: z.array(z.string().min(1)).default([]),
});

export const ActivityEventTypeSchema = z.enum([
  "commit",
  "pull_request_opened",
  "pull_request_merged",
  "pull_request_reviewed",
]);

export const ActivityEventSchema = z.object({
  type: ActivityEventTypeSchema,
  repo: z.string(),
  actor: z.string(),
  title: z.string(),
  url: z.string().url(),
  timestamp: IsoDateTimeSchema,
  additions: z.number().int().nonnegative().optional(),
  deletions: z.number().int().nonnegative().optional(),
  filesChanged: z.number().int().nonnegative().optional(),
});

export const ContributorMetricSchema = z.object({
  login: z.string(),
  eventCount: z.number().int().nonnegative(),
});

export const RepoMetricSchema = z.object({
  repo: z.string(),
  commitCount: z.number().int().nonnegative(),
  pullRequestOpenedCount: z.number().int().nonnegative(),
  pullRequestMergedCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  totalEvents: z.number().int().nonnegative(),
});

export const ActivityMetricsSchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  commitCount: z.number().int().nonnegative(),
  pullRequestOpenedCount: z.number().int().nonnegative(),
  pullRequestMergedCount: z.number().int().nonnegative(),
  reviewCount: z.number().int().nonnegative(),
  contributors: z.array(ContributorMetricSchema),
  repos: z.array(RepoMetricSchema),
});

export const CitationSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

export const MetricGridBlockSchema = z.object({
  type: z.literal("metric_grid"),
  title: z.string(),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      description: z.string().optional(),
    }),
  ),
});

export const EventFeedBlockSchema = z.object({
  type: z.literal("event_feed"),
  title: z.string(),
  events: z.array(
    z.object({
      label: z.string(),
      actor: z.string(),
      repo: z.string(),
      timestamp: IsoDateTimeSchema,
      url: z.string().url(),
    }),
  ),
});

export const RepoBreakdownBlockSchema = z.object({
  type: z.literal("repo_breakdown"),
  title: z.string(),
  rows: z.array(
    z.object({
      repo: z.string(),
      commits: z.number().int().nonnegative(),
      openedPrs: z.number().int().nonnegative(),
      mergedPrs: z.number().int().nonnegative(),
      reviews: z.number().int().nonnegative(),
      totalEvents: z.number().int().nonnegative(),
    }),
  ),
});

export const InsightListBlockSchema = z.object({
  type: z.literal("insight_list"),
  title: z.string(),
  insights: z.array(z.string().min(1)),
});

export const UiBlockSchema = z.discriminatedUnion("type", [
  MetricGridBlockSchema,
  EventFeedBlockSchema,
  RepoBreakdownBlockSchema,
  InsightListBlockSchema,
]);

export const AgentAnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
  blocks: z.array(UiBlockSchema),
  metrics: ActivityMetricsSchema,
  events: z.array(ActivityEventSchema),
});

export type TimeWindow = z.infer<typeof TimeWindowSchema>;
export type Scope = z.infer<typeof ScopeSchema>;
export type ActivityEvent = z.infer<typeof ActivityEventSchema>;
export type ActivityMetrics = z.infer<typeof ActivityMetricsSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type UiBlock = z.infer<typeof UiBlockSchema>;
export type AgentAnswer = z.infer<typeof AgentAnswerSchema>;

export function normalizeScope(input: Partial<Scope> | undefined): Scope {
  const repos = clean(input?.repos ?? []);
  const orgs = clean(input?.orgs ?? []);
  const contributors = clean(input?.contributors ?? []);

  const parsed = ScopeSchema.parse({
    repos,
    orgs,
    contributors,
  });

  return {
    repos: dedupe(parsed.repos),
    orgs: dedupe(parsed.orgs),
    contributors: dedupe(parsed.contributors),
  };
}

function dedupe(values: string[]): string[] {
  return [...new Set(clean(values))];
}

function clean(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}
