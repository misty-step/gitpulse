import type {
  RepoTimelineNode,
  GitHubEvent,
  PushEventPayload,
  PullRequestEventPayload,
  PullRequestReviewEventPayload,
  IssueCommentEventPayload,
  IssuesEventPayload,
  ReleaseEventPayload,
} from "./githubTypes";

export type EventType =
  | "pr_opened"
  | "pr_closed"
  | "pr_merged"
  | "review_submitted"
  | "commit"
  | "issue_opened"
  | "issue_closed"
  | "issue_comment";

export interface CanonicalMetrics {
  additions?: number;
  deletions?: number;
  filesChanged?: number;
}

export interface CanonicalActor {
  ghId?: number;
  ghLogin: string;
  ghNodeId?: string;
  name?: string;
  avatarUrl?: string;
}

export interface CanonicalRepo {
  ghId?: number;
  ghNodeId?: string;
  fullName: string;
  owner?: string;
  name?: string;
  url?: string;
}

export interface CanonicalEvent {
  type: EventType;
  repo: CanonicalRepo;
  actor: CanonicalActor;
  ts: number;
  canonicalText: string;
  sourceUrl: string;
  metrics?: CanonicalMetrics;
  metadata: Record<string, unknown>;
  ghId?: string;
  ghNodeId?: string;
  contentScope: "event";
}

const TEXT_LIMIT = 512;

export type CanonicalizeInput =
  | { kind: "pull_request"; payload: PullRequestWebhookEvent }
  | { kind: "pull_request_review"; payload: PullRequestReviewWebhookEvent }
  | { kind: "issues"; payload: IssuesWebhookEvent }
  | { kind: "issue_comment"; payload: IssueCommentWebhookEvent }
  | { kind: "commit"; payload: CommitLike; repository: GitHubRepository }
  | { kind: "timeline"; item: RepoTimelineNode; repoFullName: string }
  | { kind: "repo_event"; event: GitHubEvent };

export function canonicalizeEvent(
  input: CanonicalizeInput,
): CanonicalEvent | null {
  switch (input.kind) {
    case "pull_request":
      return canonicalizePullRequest(input.payload);
    case "pull_request_review":
      return canonicalizePullRequestReview(input.payload);
    case "issues":
      return canonicalizeIssue(input.payload);
    case "issue_comment":
      return canonicalizeIssueComment(input.payload);
    case "commit":
      return canonicalizeCommit(input.payload, input.repository);
    case "timeline":
      return canonicalizeTimelineItem(input.item, input.repoFullName);
    case "repo_event":
      return canonicalizeRepoEvent(input.event);
    default:
      return null;
  }
}

function canonicalizePullRequest(
  payload: PullRequestWebhookEvent,
): CanonicalEvent | null {
  const repo = normalizeRepo(payload.repository);
  const actor = normalizeActor(payload.sender ?? payload.pull_request.user);
  if (!repo || !actor) {
    return null;
  }

  const { pull_request: pr } = payload;
  const eventType = resolvePullRequestEventType(
    payload.action,
    pr.merged ?? false,
  );
  if (!eventType) {
    return null;
  }

  const ts = resolveTimestamp(
    eventType === "pr_opened"
      ? (pr.created_at ?? pr.updated_at)
      : eventType === "pr_merged"
        ? (pr.merged_at ?? pr.closed_at ?? pr.updated_at)
        : (pr.closed_at ?? pr.updated_at),
  );

  const sourceUrl = pr.html_url ?? pr.url ?? repo.url;
  if (!sourceUrl || ts === null) {
    return null;
  }

  const metrics = extractMetrics(pr.additions, pr.deletions, pr.changed_files);
  const verb =
    eventType === "pr_opened"
      ? "opened"
      : eventType === "pr_merged"
        ? "merged"
        : "closed";
  const canonicalText = truncateText(
    joinParts([
      `PR #${pr.number}`,
      pr.title ? `– ${collapseWhitespace(pr.title)}` : undefined,
      `${verb} by ${actor.ghLogin}`,
      formatMetrics(metrics),
    ]),
  );

  return {
    type: eventType,
    repo,
    actor,
    ts,
    canonicalText,
    sourceUrl,
    metrics,
    metadata: compact({
      number: pr.number,
      title: pr.title,
      merged: pr.merged,
      state: pr.state,
      baseBranch: pr.base?.ref,
      headBranch: pr.head?.ref,
    }),
    ghId: pr.id ? String(pr.id) : undefined,
    ghNodeId: pr.node_id,
    contentScope: "event",
  };
}

function canonicalizePullRequestReview(
  payload: PullRequestReviewWebhookEvent,
): CanonicalEvent | null {
  if (payload.action !== "submitted") {
    return null;
  }

  const repo = normalizeRepo(payload.repository);
  const actor = normalizeActor(payload.review.user);
  if (!repo || !actor) {
    return null;
  }

  const ts = resolveTimestamp(
    payload.review.submitted_at ??
      payload.review.submittedAt ??
      payload.pull_request.updated_at,
  );
  const sourceUrl =
    payload.review.html_url ??
    payload.review.pull_request_url ??
    payload.pull_request.html_url ??
    repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const bodySnippet = payload.review.body
    ? `– ${collapseWhitespace(payload.review.body).slice(0, 160)}`
    : undefined;
  const canonicalText = truncateText(
    joinParts([
      `Review on PR #${payload.pull_request.number}`,
      `by ${actor.ghLogin}`,
      payload.review.state ? `[${payload.review.state}]` : undefined,
      bodySnippet,
    ]),
  );

  return {
    type: "review_submitted",
    repo,
    actor,
    ts,
    canonicalText,
    sourceUrl,
    metadata: compact({
      prNumber: payload.pull_request.number,
      reviewId: payload.review.id,
      state: payload.review.state,
    }),
    ghId: payload.review.id ? String(payload.review.id) : undefined,
    ghNodeId: payload.review.node_id,
    contentScope: "event",
  };
}

function canonicalizeIssue(payload: IssuesWebhookEvent): CanonicalEvent | null {
  const repo = normalizeRepo(payload.repository);
  const actor = normalizeActor(payload.sender ?? payload.issue.user);
  if (!repo || !actor) {
    return null;
  }

  const eventType =
    payload.action === "closed"
      ? "issue_closed"
      : payload.action === "opened" || payload.action === "reopened"
        ? "issue_opened"
        : null;
  if (!eventType) {
    return null;
  }

  const ts = resolveTimestamp(
    eventType === "issue_opened"
      ? (payload.issue.created_at ?? payload.issue.updated_at)
      : (payload.issue.closed_at ?? payload.issue.updated_at),
  );
  const sourceUrl = payload.issue.html_url ?? payload.issue.url ?? repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const verb = eventType === "issue_opened" ? "opened" : "closed";
  const canonicalText = truncateText(
    joinParts([
      `Issue #${payload.issue.number}`,
      payload.issue.title
        ? `– ${collapseWhitespace(payload.issue.title)}`
        : undefined,
      `${verb} by ${actor.ghLogin}`,
    ]),
  );

  return {
    type: eventType,
    repo,
    actor,
    ts,
    canonicalText,
    sourceUrl,
    metadata: compact({
      issueNumber: payload.issue.number,
      isPullRequest: Boolean(payload.issue.pull_request),
      state: payload.issue.state,
    }),
    ghId: payload.issue.id ? String(payload.issue.id) : undefined,
    ghNodeId: payload.issue.node_id,
    contentScope: "event",
  };
}

function canonicalizeIssueComment(
  payload: IssueCommentWebhookEvent,
): CanonicalEvent | null {
  if (payload.action !== "created" && payload.action !== "edited") {
    return null;
  }

  const repo = normalizeRepo(payload.repository);
  const actor = normalizeActor(payload.comment.user ?? payload.sender);
  if (!repo || !actor) {
    return null;
  }

  const ts = resolveTimestamp(
    payload.comment.updated_at ?? payload.comment.created_at,
  );
  const sourceUrl = payload.comment.html_url ?? payload.comment.url ?? repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const target = payload.issue.pull_request ? "pull request" : "issue";
  const canonicalText = truncateText(
    joinParts([
      `Comment on ${target} #${payload.issue.number}`,
      `by ${actor.ghLogin}`,
      payload.comment.body
        ? `– ${collapseWhitespace(payload.comment.body).slice(0, 200)}`
        : undefined,
    ]),
  );

  return {
    type: "issue_comment",
    repo,
    actor,
    ts,
    canonicalText,
    sourceUrl,
    metadata: compact({
      issueNumber: payload.issue.number,
      isPullRequest: Boolean(payload.issue.pull_request),
      commentId: payload.comment.id,
    }),
    ghId: payload.comment.id ? String(payload.comment.id) : undefined,
    ghNodeId: payload.comment.node_id,
    contentScope: "event",
  };
}

function canonicalizeCommit(
  commit: CommitLike,
  repository: GitHubRepository,
): CanonicalEvent | null {
  const repo = normalizeRepo(repository);
  const actor = normalizeActor(commit.author ?? commit.committer);
  if (!repo || !actor) {
    return null;
  }

  const ts = resolveTimestamp(
    commit.timestamp ?? commit.author?.date ?? commit.committer?.date,
  );
  const sourceUrl = commit.html_url ?? commit.url ?? repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const sha = commit.sha ?? commit.id;
  const metrics = extractMetrics(
    commit.stats?.additions,
    commit.stats?.deletions,
    commit.stats?.filesChanged,
  );
  const canonicalText = truncateText(
    joinParts([
      `Commit ${sha ? sha.slice(0, 7) : ""}`.trim(),
      `by ${actor.ghLogin}`,
      commit.message
        ? `– ${collapseWhitespace(commit.message).slice(0, 200)}`
        : undefined,
      formatMetrics(metrics),
    ]),
  );

  return {
    type: "commit",
    repo,
    actor,
    ts,
    canonicalText,
    sourceUrl,
    metrics,
    metadata: compact({
      sha,
      message: commit.message,
    }),
    ghId: sha,
    ghNodeId: commit.node_id,
    contentScope: "event",
  };
}

function canonicalizeTimelineItem(
  item: RepoTimelineNode,
  repoFullName: string,
): CanonicalEvent | null {
  const repo: CanonicalRepo = {
    fullName: repoFullName,
  };

  const timelineActor = item.actor
    ? {
        id: item.actor.id,
        login: item.actor.login,
        node_id: item.actor.nodeId,
      }
    : undefined;
  const actor = normalizeActor(timelineActor);
  if (!actor) {
    return null;
  }

  const ts = resolveTimestamp(item.updatedAt);
  const sourceUrl = item.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const isPr = item.__typename === "PullRequest";
  let eventType: EventType;
  if (isPr) {
    eventType =
      item.state?.toLowerCase() === "closed" ? "pr_closed" : "pr_opened";
  } else {
    eventType =
      item.state?.toLowerCase() === "closed" ? "issue_closed" : "issue_opened";
  }

  const canonicalText = truncateText(
    joinParts([
      `${isPr ? "PR" : "Issue"} #${item.number ?? ""}`.trim(),
      item.title ? `– ${collapseWhitespace(item.title)}` : undefined,
      `${eventType === "pr_opened" || eventType === "issue_opened" ? "recorded" : "updated"} by ${actor.ghLogin}`,
    ]),
  );

  return {
    type: eventType,
    repo,
    actor,
    ts,
    canonicalText,
    sourceUrl,
    metadata: compact({
      itemId: item.id,
      state: item.state,
      timeline: true,
    }),
    ghId: item.id,
    ghNodeId: item.id,
    contentScope: "event",
  };
}

// ============================================================================
// GitHub Events API Canonicalization
// ============================================================================

/**
 * Canonicalize a GitHub Events API event.
 *
 * Deep Module Design:
 * - Simple interface: one GitHubEvent in, one CanonicalEvent out (or null)
 * - Hides: Event type dispatch, payload extraction, URL construction
 * - Returns: Uniform canonical event for all event types
 *
 * Note: PushEvent yields multiple CanonicalEvents (one per commit).
 * This function returns only the first commit; use canonicalizeRepoEventAll()
 * if you need all commits from a push.
 */
function canonicalizeRepoEvent(event: GitHubEvent): CanonicalEvent | null {
  const repo: CanonicalRepo = {
    ghId: event.repo.id,
    fullName: event.repo.name,
  };

  const actor: CanonicalActor = {
    ghId: event.actor.id,
    ghLogin: event.actor.login,
    avatarUrl: event.actor.avatar_url,
  };

  const ts = resolveTimestamp(event.created_at);
  if (ts === null) {
    return null;
  }

  switch (event.type) {
    case "PushEvent":
      return canonicalizePushEvent(event, repo, actor, ts);
    case "PullRequestEvent":
      return canonicalizePREvent(event, repo, actor, ts);
    case "PullRequestReviewEvent":
      return canonicalizePRReviewEvent(event, repo, actor, ts);
    case "IssueCommentEvent":
      return canonicalizeIssueCommentEvent(event, repo, actor, ts);
    case "IssuesEvent":
      return canonicalizeIssuesEvent(event, repo, actor, ts);
    case "ReleaseEvent":
      return canonicalizeReleaseEvent(event, repo, actor, ts);
    default:
      // Skip unhandled event types (WatchEvent, ForkEvent, CreateEvent, etc.)
      return null;
  }
}

/**
 * Canonicalize ALL events from a GitHub Events API event.
 *
 * Unlike canonicalizeRepoEvent which returns a single event,
 * this returns an array to handle PushEvent's multiple commits.
 */
export function canonicalizeRepoEventAll(event: GitHubEvent): CanonicalEvent[] {
  const repo: CanonicalRepo = {
    ghId: event.repo.id,
    fullName: event.repo.name,
  };

  const actor: CanonicalActor = {
    ghId: event.actor.id,
    ghLogin: event.actor.login,
    avatarUrl: event.actor.avatar_url,
  };

  const ts = resolveTimestamp(event.created_at);
  if (ts === null) {
    return [];
  }

  if (event.type === "PushEvent") {
    return canonicalizePushEventAll(event, repo, actor, ts);
  }

  const single = canonicalizeRepoEvent(event);
  return single ? [single] : [];
}

function canonicalizePushEvent(
  event: GitHubEvent,
  repo: CanonicalRepo,
  actor: CanonicalActor,
  ts: number
): CanonicalEvent | null {
  const payload = event.payload as PushEventPayload;
  if (!payload.commits || payload.commits.length === 0) {
    return null;
  }

  // Return the first commit (most recent in the push)
  const commit = payload.commits[0];
  const shortSha = commit.sha.slice(0, 7);
  const branch = payload.ref.replace("refs/heads/", "");

  return {
    type: "commit",
    repo,
    actor,
    ts,
    canonicalText: truncateText(
      joinParts([
        `Commit ${shortSha}`,
        `by ${actor.ghLogin}`,
        `on ${branch}`,
        commit.message ? `– ${collapseWhitespace(commit.message).slice(0, 200)}` : undefined,
      ])
    ),
    sourceUrl: commit.url.replace("api.github.com/repos", "github.com").replace("/commits/", "/commit/"),
    metadata: compact({
      sha: commit.sha,
      message: commit.message,
      branch,
      pushSize: payload.size,
      distinctSize: payload.distinct_size,
    }),
    ghId: commit.sha,
    contentScope: "event",
  };
}

function canonicalizePushEventAll(
  event: GitHubEvent,
  repo: CanonicalRepo,
  actor: CanonicalActor,
  ts: number
): CanonicalEvent[] {
  const payload = event.payload as PushEventPayload;
  if (!payload.commits || payload.commits.length === 0) {
    return [];
  }

  const branch = payload.ref.replace("refs/heads/", "");

  return payload.commits.map((commit, index) => {
    const shortSha = commit.sha.slice(0, 7);
    // Offset timestamp slightly for each commit to preserve ordering
    const commitTs = ts - (payload.commits.length - 1 - index) * 1000;

    return {
      type: "commit" as EventType,
      repo,
      actor: {
        ...actor,
        // Override with commit author if available
        ghLogin: commit.author?.name || actor.ghLogin,
      },
      ts: commitTs,
      canonicalText: truncateText(
        joinParts([
          `Commit ${shortSha}`,
          `by ${commit.author?.name || actor.ghLogin}`,
          `on ${branch}`,
          commit.message ? `– ${collapseWhitespace(commit.message).slice(0, 200)}` : undefined,
        ])
      ),
      sourceUrl: commit.url.replace("api.github.com/repos", "github.com").replace("/commits/", "/commit/"),
      metadata: compact({
        sha: commit.sha,
        message: commit.message,
        branch,
        authorEmail: commit.author?.email,
        distinct: commit.distinct,
      }),
      ghId: commit.sha,
      contentScope: "event" as const,
    };
  });
}

function canonicalizePREvent(
  event: GitHubEvent,
  repo: CanonicalRepo,
  actor: CanonicalActor,
  ts: number
): CanonicalEvent | null {
  const payload = event.payload as PullRequestEventPayload;
  const { action, pull_request: pr } = payload;

  // Only track meaningful PR actions
  const eventType = resolvePullRequestEventType(action, pr.merged ?? false);
  if (!eventType) {
    return null;
  }

  const metrics = extractMetrics(pr.additions, pr.deletions, pr.changed_files);
  const verb =
    eventType === "pr_opened" ? "opened" :
    eventType === "pr_merged" ? "merged" : "closed";

  // Guard against null/undefined html_url (GitHub Events API sometimes returns null)
  const sourceUrl = pr.html_url ?? `https://github.com/${repo.fullName}/pull/${pr.number}`;

  return {
    type: eventType,
    repo,
    actor,
    ts,
    canonicalText: truncateText(
      joinParts([
        `PR #${pr.number}`,
        pr.title ? `– ${collapseWhitespace(pr.title)}` : undefined,
        `${verb} by ${actor.ghLogin}`,
        formatMetrics(metrics),
      ])
    ),
    sourceUrl,
    metrics,
    metadata: compact({
      number: pr.number,
      title: pr.title,
      merged: pr.merged,
      state: pr.state,
      baseBranch: pr.base?.ref,
      headBranch: pr.head?.ref,
    }),
    ghId: String(pr.id),
    ghNodeId: pr.node_id,
    contentScope: "event",
  };
}

function canonicalizePRReviewEvent(
  event: GitHubEvent,
  repo: CanonicalRepo,
  actor: CanonicalActor,
  ts: number
): CanonicalEvent | null {
  const payload = event.payload as PullRequestReviewEventPayload;

  // Only track submitted reviews
  if (payload.action !== "submitted") {
    return null;
  }

  const { review, pull_request: pr } = payload;
  const bodySnippet = review.body
    ? `– ${collapseWhitespace(review.body).slice(0, 160)}`
    : undefined;

  return {
    type: "review_submitted",
    repo,
    actor,
    ts,
    canonicalText: truncateText(
      joinParts([
        `Review on PR #${pr.number}`,
        `by ${actor.ghLogin}`,
        review.state ? `[${review.state}]` : undefined,
        bodySnippet,
      ])
    ),
    sourceUrl: review.html_url,
    metadata: compact({
      prNumber: pr.number,
      prTitle: pr.title,
      reviewId: review.id,
      state: review.state,
    }),
    ghId: String(review.id),
    ghNodeId: review.node_id,
    contentScope: "event",
  };
}

function canonicalizeIssueCommentEvent(
  event: GitHubEvent,
  repo: CanonicalRepo,
  actor: CanonicalActor,
  ts: number
): CanonicalEvent | null {
  const payload = event.payload as IssueCommentEventPayload;

  // Only track created comments
  if (payload.action !== "created") {
    return null;
  }

  const { comment, issue } = payload;
  const target = issue.pull_request ? "pull request" : "issue";

  return {
    type: "issue_comment",
    repo,
    actor,
    ts,
    canonicalText: truncateText(
      joinParts([
        `Comment on ${target} #${issue.number}`,
        `by ${actor.ghLogin}`,
        comment.body
          ? `– ${collapseWhitespace(comment.body).slice(0, 200)}`
          : undefined,
      ])
    ),
    sourceUrl: comment.html_url,
    metadata: compact({
      issueNumber: issue.number,
      issueTitle: issue.title,
      isPullRequest: Boolean(issue.pull_request),
      commentId: comment.id,
    }),
    ghId: String(comment.id),
    ghNodeId: comment.node_id,
    contentScope: "event",
  };
}

function canonicalizeIssuesEvent(
  event: GitHubEvent,
  repo: CanonicalRepo,
  actor: CanonicalActor,
  ts: number
): CanonicalEvent | null {
  const payload = event.payload as IssuesEventPayload;
  const { action, issue } = payload;

  const eventType =
    action === "closed" ? "issue_closed" :
    action === "opened" || action === "reopened" ? "issue_opened" : null;

  if (!eventType) {
    return null;
  }

  const verb = eventType === "issue_opened" ? "opened" : "closed";

  return {
    type: eventType,
    repo,
    actor,
    ts,
    canonicalText: truncateText(
      joinParts([
        `Issue #${issue.number}`,
        issue.title ? `– ${collapseWhitespace(issue.title)}` : undefined,
        `${verb} by ${actor.ghLogin}`,
      ])
    ),
    sourceUrl: issue.html_url,
    metadata: compact({
      issueNumber: issue.number,
      title: issue.title,
      state: issue.state,
    }),
    ghId: String(issue.id),
    ghNodeId: issue.node_id,
    contentScope: "event",
  };
}

function canonicalizeReleaseEvent(
  event: GitHubEvent,
  repo: CanonicalRepo,
  actor: CanonicalActor,
  ts: number
): CanonicalEvent | null {
  const payload = event.payload as ReleaseEventPayload;

  // Only track published releases
  if (payload.action !== "published") {
    return null;
  }

  const { release } = payload;

  // Map release to pr_opened type (or we could add a "release" type if needed)
  // For now, we skip releases since they're less common in daily standups
  // but the infrastructure is here if we want to add a "release" EventType
  return null;

  // Uncomment if we want to track releases:
  // return {
  //   type: "release", // Would need to add to EventType
  //   repo,
  //   actor,
  //   ts,
  //   canonicalText: truncateText(
  //     joinParts([
  //       `Release ${release.tag_name}`,
  //       release.name ? `– ${collapseWhitespace(release.name)}` : undefined,
  //       `published by ${actor.ghLogin}`,
  //     ])
  //   ),
  //   sourceUrl: release.html_url,
  //   metadata: compact({
  //     tagName: release.tag_name,
  //     name: release.name,
  //     prerelease: release.prerelease,
  //     draft: release.draft,
  //   }),
  //   ghId: String(release.id),
  //   ghNodeId: release.node_id,
  //   contentScope: "event",
  // };
}

function normalizeRepo(repo?: GitHubRepository | null): CanonicalRepo | null {
  if (!repo) {
    return null;
  }
  const fullName =
    repo.full_name ??
    (repo.owner?.login && repo.name
      ? `${repo.owner.login}/${repo.name}`
      : undefined);
  if (!fullName) {
    return null;
  }
  return {
    ghId: repo.id,
    ghNodeId: repo.node_id,
    fullName,
    owner: repo.owner?.login,
    name: repo.name,
    url: repo.html_url,
  };
}

function normalizeActor(
  user?: GitHubUser | CommitAuthor | null,
): CanonicalActor | null {
  if (!user) {
    return null;
  }

  const login =
    user.login ??
    user.username ??
    (typeof user.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : undefined) ??
    (typeof (user as CommitAuthor).email === "string"
      ? (user as CommitAuthor).email?.split("@")[0]
      : undefined);

  if (!login) {
    return null;
  }

  return {
    ghId: typeof user.id === "number" ? user.id : undefined,
    ghLogin: login,
    ghNodeId: user.node_id,
    name: user.name,
    avatarUrl: user.avatar_url,
  };
}

function resolvePullRequestEventType(
  action: string,
  merged: boolean,
): EventType | null {
  if (
    action === "opened" ||
    action === "reopened" ||
    action === "ready_for_review"
  ) {
    return "pr_opened";
  }
  if (action === "closed") {
    return merged ? "pr_merged" : "pr_closed";
  }
  return null;
}

function resolveTimestamp(value?: string | number | null): number | null {
  if (!value) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractMetrics(
  additions?: number | null,
  deletions?: number | null,
  filesChanged?: number | null,
): CanonicalMetrics | undefined {
  const metrics: CanonicalMetrics = {};
  if (typeof additions === "number") {
    metrics.additions = additions;
  }
  if (typeof deletions === "number") {
    metrics.deletions = deletions;
  }
  if (typeof filesChanged === "number") {
    metrics.filesChanged = filesChanged;
  }
  return Object.keys(metrics).length ? metrics : undefined;
}

function formatMetrics(metrics?: CanonicalMetrics): string | undefined {
  if (!metrics) {
    return undefined;
  }
  const parts: string[] = [];
  if (typeof metrics.additions === "number") {
    parts.push(`+${metrics.additions}`);
  }
  if (typeof metrics.deletions === "number") {
    parts.push(`-${metrics.deletions}`);
  }
  if (typeof metrics.filesChanged === "number") {
    parts.push(`${metrics.filesChanged} files`);
  }
  return parts.length ? `(${parts.join(", ")})` : undefined;
}

function truncateText(value: string): string {
  if (value.length <= TEXT_LIMIT) {
    return value;
  }
  return `${value.slice(0, TEXT_LIMIT - 1)}…`;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function joinParts(parts: Array<string | undefined>): string {
  return parts
    .filter((part) => Boolean(part && part.trim()))
    .join(" ")
    .trim();
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  const entries = Object.entries(obj).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  return Object.fromEntries(entries) as T;
}

/**
 * GitHub payload type definitions (subset of fields we rely on)
 */
interface GitHubUser {
  id?: number;
  login?: string;
  node_id?: string;
  avatar_url?: string;
  name?: string;
  username?: string;
  email?: string;
}

interface GitHubRepository {
  id?: number;
  node_id?: string;
  name?: string;
  full_name?: string;
  html_url?: string;
  owner?: GitHubUser;
}

export interface PullRequestWebhookEvent {
  action: string;
  pull_request: {
    id?: number;
    node_id?: string;
    number: number;
    title?: string;
    body?: string | null;
    html_url?: string;
    url?: string;
    created_at?: string;
    updated_at?: string;
    closed_at?: string | null;
    merged_at?: string | null;
    merged?: boolean;
    state?: string;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    base?: { ref?: string };
    head?: { ref?: string };
    user?: GitHubUser;
  };
  repository?: GitHubRepository | null;
  sender?: GitHubUser | null;
}

export interface PullRequestReviewWebhookEvent {
  action: string;
  review: {
    id?: number;
    node_id?: string;
    html_url?: string;
    pull_request_url?: string;
    state?: string;
    body?: string | null;
    submitted_at?: string;
    submittedAt?: string;
    user?: GitHubUser | null;
  };
  pull_request: {
    number: number;
    html_url?: string;
    updated_at?: string;
  };
  repository?: GitHubRepository | null;
}

export interface IssuesWebhookEvent {
  action: string;
  issue: {
    id?: number;
    node_id?: string;
    number: number;
    title?: string;
    body?: string | null;
    html_url?: string;
    url?: string;
    created_at?: string;
    updated_at?: string;
    closed_at?: string | null;
    user?: GitHubUser;
    pull_request?: Record<string, unknown> | null;
    state?: string;
  };
  repository?: GitHubRepository | null;
  sender?: GitHubUser | null;
}

export interface IssueCommentWebhookEvent {
  action: string;
  comment: {
    id?: number;
    node_id?: string;
    body?: string | null;
    html_url?: string;
    url?: string;
    created_at?: string;
    updated_at?: string;
    user?: GitHubUser | null;
  };
  issue: IssuesWebhookEvent["issue"];
  repository?: GitHubRepository | null;
  sender?: GitHubUser | null;
}

interface CommitAuthor extends GitHubUser {
  email?: string;
  date?: string;
}

interface CommitStats {
  additions?: number;
  deletions?: number;
  filesChanged?: number;
  total?: number;
}

interface CommitLike {
  id?: string;
  sha?: string;
  node_id?: string;
  message?: string;
  timestamp?: string;
  url?: string;
  html_url?: string;
  author?: CommitAuthor | null;
  committer?: CommitAuthor | null;
  stats?: CommitStats;
}

/**
 * Convert GitHubCommit (Commits API format) to CommitLike (for canonicalization).
 *
 * The Commits API returns a different structure than webhooks/events API.
 * This adapter normalizes it for use with canonicalizeEvent({ kind: "commit", ... }).
 */
export function convertGitHubCommitToCommitLike(
  commit: {
    sha: string;
    node_id: string;
    commit: {
      message: string;
      author: { name: string; email: string; date: string };
    };
    author: { id: number; login: string; node_id: string } | null;
    html_url: string;
    stats?: { additions: number; deletions: number; total: number };
  }
): CommitLike {
  return {
    sha: commit.sha,
    node_id: commit.node_id,
    message: commit.commit.message,
    timestamp: commit.commit.author.date,
    html_url: commit.html_url,
    author: commit.author
      ? {
          id: commit.author.id,
          login: commit.author.login,
          node_id: commit.author.node_id,
          name: commit.commit.author.name,
          email: commit.commit.author.email,
        }
      : null,
    stats: commit.stats
      ? {
          additions: commit.stats.additions,
          deletions: commit.stats.deletions,
          total: commit.stats.total,
        }
      : undefined,
  };
}

export type { GitHubRepository, CommitLike };
