import type { RepoTimelineNode } from "./githubTypes";

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
  | { kind: "timeline"; item: RepoTimelineNode; repoFullName: string };

export function canonicalizeEvent(input: CanonicalizeInput): CanonicalEvent | null {
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
    default:
      return null;
  }
}

function canonicalizePullRequest(payload: PullRequestWebhookEvent): CanonicalEvent | null {
  const repo = normalizeRepo(payload.repository);
  const actor = normalizeActor(payload.sender ?? payload.pull_request.user);
  if (!repo || !actor) {
    return null;
  }

  const { pull_request: pr } = payload;
  const eventType = resolvePullRequestEventType(payload.action, pr.merged ?? false);
  if (!eventType) {
    return null;
  }

  const ts = resolveTimestamp(
    eventType === "pr_opened"
      ? pr.created_at ?? pr.updated_at
      : eventType === "pr_merged"
        ? pr.merged_at ?? pr.closed_at ?? pr.updated_at
        : pr.closed_at ?? pr.updated_at
  );

  const sourceUrl = pr.html_url ?? pr.url ?? repo.url;
  if (!sourceUrl || ts === null) {
    return null;
  }

  const metrics = extractMetrics(pr.additions, pr.deletions, pr.changed_files);
  const verb = eventType === "pr_opened" ? "opened" : eventType === "pr_merged" ? "merged" : "closed";
  const canonicalText = truncateText(
    joinParts([
      `PR #${pr.number}`,
      pr.title ? `– ${collapseWhitespace(pr.title)}` : undefined,
      `${verb} by ${actor.ghLogin}`,
      formatMetrics(metrics),
    ])
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

function canonicalizePullRequestReview(payload: PullRequestReviewWebhookEvent): CanonicalEvent | null {
  if (payload.action !== "submitted") {
    return null;
  }

  const repo = normalizeRepo(payload.repository);
  const actor = normalizeActor(payload.review.user);
  if (!repo || !actor) {
    return null;
  }

  const ts = resolveTimestamp(payload.review.submitted_at ?? payload.review.submittedAt ?? payload.pull_request.updated_at);
  const sourceUrl = payload.review.html_url ?? payload.review.pull_request_url ?? payload.pull_request.html_url ?? repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const bodySnippet = payload.review.body ? `– ${collapseWhitespace(payload.review.body).slice(0, 160)}` : undefined;
  const canonicalText = truncateText(
    joinParts([
      `Review on PR #${payload.pull_request.number}`,
      `by ${actor.ghLogin}`,
      payload.review.state ? `[${payload.review.state}]` : undefined,
      bodySnippet,
    ])
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

  const eventType = payload.action === "closed" ? "issue_closed" : payload.action === "opened" || payload.action === "reopened" ? "issue_opened" : null;
  if (!eventType) {
    return null;
  }

  const ts = resolveTimestamp(
    eventType === "issue_opened" ? payload.issue.created_at ?? payload.issue.updated_at : payload.issue.closed_at ?? payload.issue.updated_at
  );
  const sourceUrl = payload.issue.html_url ?? payload.issue.url ?? repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const verb = eventType === "issue_opened" ? "opened" : "closed";
  const canonicalText = truncateText(
    joinParts([
      `Issue #${payload.issue.number}`,
      payload.issue.title ? `– ${collapseWhitespace(payload.issue.title)}` : undefined,
      `${verb} by ${actor.ghLogin}`,
    ])
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

function canonicalizeIssueComment(payload: IssueCommentWebhookEvent): CanonicalEvent | null {
  if (payload.action !== "created" && payload.action !== "edited") {
    return null;
  }

  const repo = normalizeRepo(payload.repository);
  const actor = normalizeActor(payload.comment.user ?? payload.sender);
  if (!repo || !actor) {
    return null;
  }

  const ts = resolveTimestamp(payload.comment.updated_at ?? payload.comment.created_at);
  const sourceUrl = payload.comment.html_url ?? payload.comment.url ?? repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const target = payload.issue.pull_request ? "pull request" : "issue";
  const canonicalText = truncateText(
    joinParts([
      `Comment on ${target} #${payload.issue.number}`,
      `by ${actor.ghLogin}`,
      payload.comment.body ? `– ${collapseWhitespace(payload.comment.body).slice(0, 200)}` : undefined,
    ])
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

function canonicalizeCommit(commit: CommitLike, repository: GitHubRepository): CanonicalEvent | null {
  const repo = normalizeRepo(repository);
  const actor = normalizeActor(commit.author ?? commit.committer);
  if (!repo || !actor) {
    return null;
  }

  const ts = resolveTimestamp(commit.timestamp ?? commit.author?.date ?? commit.committer?.date);
  const sourceUrl = commit.html_url ?? commit.url ?? repo.url;
  if (ts === null || !sourceUrl) {
    return null;
  }

  const sha = commit.sha ?? commit.id;
  const metrics = extractMetrics(commit.stats?.additions, commit.stats?.deletions, commit.stats?.filesChanged);
  const canonicalText = truncateText(
    joinParts([
      `Commit ${sha ? sha.slice(0, 7) : ""}`.trim(),
      `by ${actor.ghLogin}`,
      commit.message ? `– ${collapseWhitespace(commit.message).slice(0, 200)}` : undefined,
      formatMetrics(metrics),
    ])
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

function canonicalizeTimelineItem(item: RepoTimelineNode, repoFullName: string): CanonicalEvent | null {
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
    eventType = item.state?.toLowerCase() === "closed" ? "pr_closed" : "pr_opened";
  } else {
    eventType = item.state?.toLowerCase() === "closed" ? "issue_closed" : "issue_opened";
  }

  const canonicalText = truncateText(
    joinParts([
      `${isPr ? "PR" : "Issue"} #${item.number ?? ""}`.trim(),
      item.title ? `– ${collapseWhitespace(item.title)}` : undefined,
      `${eventType === "pr_opened" || eventType === "issue_opened" ? "recorded" : "updated"} by ${actor.ghLogin}`,
    ])
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

function normalizeRepo(repo?: GitHubRepository | null): CanonicalRepo | null {
  if (!repo) {
    return null;
  }
  const fullName = repo.full_name ?? (repo.owner?.login && repo.name ? `${repo.owner.login}/${repo.name}` : undefined);
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

function normalizeActor(user?: GitHubUser | CommitAuthor | null): CanonicalActor | null {
  if (!user) {
    return null;
  }

  const login =
    user.login ??
    user.username ??
    (typeof user.name === "string" && user.name.trim().length > 0 ? user.name.trim() : undefined) ??
    (typeof (user as CommitAuthor).email === "string" ? (user as CommitAuthor).email?.split("@")[0] : undefined);

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

function resolvePullRequestEventType(action: string, merged: boolean): EventType | null {
  if (action === "opened" || action === "reopened" || action === "ready_for_review") {
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
  filesChanged?: number | null
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
  return parts.filter((part) => Boolean(part && part.trim())).join(" ").trim();
}

function compact<T extends Record<string, unknown>>(obj: T): T {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined && value !== null);
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

export type {
  GitHubRepository,
  CommitLike,
};
