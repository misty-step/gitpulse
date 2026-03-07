import type { ActivityEvent, ActivityMetrics, Citation, UiBlock } from "@gitpulse/schemas";

export function computeMetrics(events: ActivityEvent[]): ActivityMetrics {
  const contributorMap = new Map<string, number>();
  const repoMap = new Map<
    string,
    {
      commitCount: number;
      pullRequestOpenedCount: number;
      pullRequestMergedCount: number;
      reviewCount: number;
      totalEvents: number;
    }
  >();

  let commitCount = 0;
  let pullRequestOpenedCount = 0;
  let pullRequestMergedCount = 0;
  let reviewCount = 0;

  for (const event of events) {
    contributorMap.set(event.actor, (contributorMap.get(event.actor) ?? 0) + 1);

    const repoMetrics = repoMap.get(event.repo) ?? {
      commitCount: 0,
      pullRequestOpenedCount: 0,
      pullRequestMergedCount: 0,
      reviewCount: 0,
      totalEvents: 0,
    };

    repoMetrics.totalEvents += 1;

    if (event.type === "commit") {
      commitCount += 1;
      repoMetrics.commitCount += 1;
    } else if (event.type === "pull_request_opened") {
      pullRequestOpenedCount += 1;
      repoMetrics.pullRequestOpenedCount += 1;
    } else if (event.type === "pull_request_merged") {
      pullRequestMergedCount += 1;
      repoMetrics.pullRequestMergedCount += 1;
    } else if (event.type === "pull_request_reviewed") {
      reviewCount += 1;
      repoMetrics.reviewCount += 1;
    }

    repoMap.set(event.repo, repoMetrics);
  }

  return {
    totalEvents: events.length,
    commitCount,
    pullRequestOpenedCount,
    pullRequestMergedCount,
    reviewCount,
    contributors: [...contributorMap.entries()]
      .map(([login, eventCount]) => ({ login, eventCount }))
      .sort((a, b) => b.eventCount - a.eventCount || a.login.localeCompare(b.login)),
    repos: [...repoMap.entries()]
      .map(([repo, value]) => ({
        repo,
        commitCount: value.commitCount,
        pullRequestOpenedCount: value.pullRequestOpenedCount,
        pullRequestMergedCount: value.pullRequestMergedCount,
        reviewCount: value.reviewCount,
        totalEvents: value.totalEvents,
      }))
      .sort((a, b) => b.totalEvents - a.totalEvents || a.repo.localeCompare(b.repo)),
  };
}

export function buildCitations(events: ActivityEvent[], max = 25): Citation[] {
  if (max <= 0) {
    return [];
  }

  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const event of events) {
    if (seen.has(event.url)) {
      continue;
    }

    if (citations.length >= max) {
      break;
    }

    seen.add(event.url);
    citations.push({
      label: `[${event.repo}] ${event.title}`,
      url: event.url,
    });
  }

  return citations;
}

export function buildBlocks(metrics: ActivityMetrics, events: ActivityEvent[], insights: string[]): UiBlock[] {
  const blocks: UiBlock[] = [
    {
      type: "metric_grid",
      title: "Activity Overview",
      metrics: [
        {
          label: "Total Events",
          value: String(metrics.totalEvents),
          description: "Commits, PR events, and reviews in scope",
        },
        {
          label: "Commits",
          value: String(metrics.commitCount),
        },
        {
          label: "PRs Opened",
          value: String(metrics.pullRequestOpenedCount),
        },
        {
          label: "PRs Merged",
          value: String(metrics.pullRequestMergedCount),
        },
        {
          label: "Reviews",
          value: String(metrics.reviewCount),
        },
        {
          label: "Contributors",
          value: String(metrics.contributors.length),
        },
      ],
    },
    {
      type: "repo_breakdown",
      title: "Repo Breakdown",
      rows: metrics.repos.slice(0, 12).map((repo) => ({
        repo: repo.repo,
        commits: repo.commitCount,
        openedPrs: repo.pullRequestOpenedCount,
        mergedPrs: repo.pullRequestMergedCount,
        reviews: repo.reviewCount,
        totalEvents: repo.totalEvents,
      })),
    },
    {
      type: "event_feed",
      title: "Latest Activity",
      events: events.slice(0, 25).map((event) => ({
        label: describeEvent(event),
        actor: event.actor,
        repo: event.repo,
        timestamp: event.timestamp,
        url: event.url,
      })),
    },
  ];

  if (insights.length > 0) {
    blocks.push({
      type: "insight_list",
      title: "Key Insights",
      insights,
    });
  }

  return blocks;
}

const EVENT_LABELS: Record<ActivityEvent["type"], string> = {
  commit: "Commit",
  pull_request_opened: "PR Opened",
  pull_request_merged: "PR Merged",
  pull_request_reviewed: "Review",
};

export function describeEvent(event: ActivityEvent): string {
  return `${EVENT_LABELS[event.type]}: ${event.title}`;
}
