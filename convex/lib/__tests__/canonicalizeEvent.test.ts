import { canonicalizeEvent } from "../canonicalizeEvent";
import type {
  CommitLike,
  GitHubRepository,
  IssueCommentWebhookEvent,
  IssuesWebhookEvent,
  PullRequestReviewWebhookEvent,
  PullRequestWebhookEvent,
} from "../canonicalizeEvent";

const repo: GitHubRepository = {
  id: 1,
  node_id: "R_1",
  name: "repo",
  full_name: "org/repo",
  html_url: "https://github.com/org/repo",
  owner: { login: "org" },
};

const actor = { login: "alice", id: 99, node_id: "U_99" };

describe("canonicalizeEvent", () => {
  describe("pull requests", () => {
    it("canonicalizes an opened pull request", () => {
      const payload: PullRequestWebhookEvent = {
        action: "opened",
        pull_request: {
          number: 42,
          title: "Add search",
          html_url: "https://github.com/org/repo/pull/42",
          created_at: "2025-01-01T00:00:00Z",
          additions: 10,
          deletions: 2,
          changed_files: 3,
          user: actor,
        },
        repository: repo,
        sender: actor,
      };

      const event = canonicalizeEvent({ kind: "pull_request", payload });

      expect(event).toMatchObject({
        type: "pr_opened",
        repo: { fullName: "org/repo" },
        actor: { ghLogin: "alice" },
        ts: Date.parse("2025-01-01T00:00:00Z"),
        metrics: { additions: 10, deletions: 2, filesChanged: 3 },
      });
      expect(event?.canonicalText).toContain("PR #42");
      expect(event?.canonicalText).toContain("opened by alice");
      expect(event?.sourceUrl).toBe("https://github.com/org/repo/pull/42");
    });

    it("canonicalizes a merged pull request using merged_at timestamp", () => {
      const payload: PullRequestWebhookEvent = {
        action: "closed",
        pull_request: {
          number: 7,
          merged: true,
          merged_at: "2025-01-02T12:00:00Z",
          closed_at: "2025-01-02T12:05:00Z",
          html_url: "https://github.com/org/repo/pull/7",
          user: actor,
        },
        repository: repo,
        sender: actor,
      };

      const event = canonicalizeEvent({ kind: "pull_request", payload });

      expect(event?.type).toBe("pr_merged");
      expect(event?.ts).toBe(Date.parse("2025-01-02T12:00:00Z"));
      expect(event?.canonicalText).toContain("merged by alice");
    });

    it("canonicalizes a closed (not merged) pull request", () => {
      const payload: PullRequestWebhookEvent = {
        action: "closed",
        pull_request: {
          number: 8,
          merged: false,
          closed_at: "2025-01-03T08:00:00Z",
          html_url: "https://github.com/org/repo/pull/8",
          user: actor,
        },
        repository: repo,
        sender: actor,
      };

      const event = canonicalizeEvent({ kind: "pull_request", payload });

      expect(event?.type).toBe("pr_closed");
      expect(event?.canonicalText).toContain("closed by alice");
    });
  });

  describe("issues", () => {
    it("canonicalizes an opened issue", () => {
      const payload: IssuesWebhookEvent = {
        action: "opened",
        issue: {
          number: 11,
          title: "Login bug",
          html_url: "https://github.com/org/repo/issues/11",
          created_at: "2025-02-01T00:00:00Z",
          user: actor,
        },
        repository: repo,
        sender: actor,
      };

      const event = canonicalizeEvent({ kind: "issues", payload });

      expect(event?.type).toBe("issue_opened");
      expect(event?.canonicalText).toContain("Issue #11");
      expect(event?.actor.ghLogin).toBe("alice");
    });

    it("preserves unicode in titles", () => {
      const payload: IssuesWebhookEvent = {
        action: "opened",
        issue: {
          number: 12,
          title: "非ASCII emoji 🚀 title",
          html_url: "https://github.com/org/repo/issues/12",
          created_at: "2025-02-02T00:00:00Z",
          user: actor,
        },
        repository: repo,
        sender: actor,
      };

      const event = canonicalizeEvent({ kind: "issues", payload });

      expect(event?.canonicalText).toContain("🚀");
      expect(event?.canonicalText).toContain("非ASCII");
    });
  });

  describe("issue comments", () => {
    it("canonicalizes a created issue comment with body snippet", () => {
      const payload: IssueCommentWebhookEvent = {
        action: "created",
        comment: {
          id: 123,
          body: "Thanks for the report!",
          html_url: "https://github.com/org/repo/issues/11#issuecomment-1",
          updated_at: "2025-03-01T10:00:00Z",
          user: actor,
        },
        issue: {
          number: 11,
          html_url: "https://github.com/org/repo/issues/11",
          user: actor,
        } as IssuesWebhookEvent["issue"],
        repository: repo,
        sender: actor,
      };

      const event = canonicalizeEvent({ kind: "issue_comment", payload });

      expect(event?.type).toBe("issue_comment");
      expect(event?.canonicalText).toContain("Comment on issue #11");
      expect(event?.canonicalText).toContain("Thanks for the report!");
    });

    it("caps comment body snippet to 200 characters", () => {
      const longBody = "a".repeat(1200);
      const payload: IssueCommentWebhookEvent = {
        action: "created",
        comment: {
          id: 124,
          body: longBody,
          html_url: "https://github.com/org/repo/issues/11#issuecomment-2",
          updated_at: "2025-03-02T10:00:00Z",
          user: actor,
        },
        issue: {
          number: 11,
          html_url: "https://github.com/org/repo/issues/11",
          user: actor,
        } as IssuesWebhookEvent["issue"],
        repository: repo,
        sender: actor,
      };

      const event = canonicalizeEvent({ kind: "issue_comment", payload });

      const bodySnippet = event?.canonicalText?.match(/a+/)?.[0] ?? "";
      expect(bodySnippet.length).toBeGreaterThan(0);
      expect(bodySnippet.length).toBeLessThanOrEqual(200);
      expect(event?.canonicalText?.length).toBeLessThanOrEqual(260);
    });
  });

  describe("pull request reviews", () => {
    it("canonicalizes a submitted review", () => {
      const payload: PullRequestReviewWebhookEvent = {
        action: "submitted",
        review: {
          id: 555,
          state: "approved",
          body: "LGTM",
          html_url: "https://github.com/org/repo/pull/1#review-555",
          submitted_at: "2025-04-01T00:00:00Z",
          user: actor,
        },
        pull_request: {
          number: 1,
          html_url: "https://github.com/org/repo/pull/1",
          updated_at: "2025-04-01T00:00:00Z",
        },
        repository: repo,
      };

      const event = canonicalizeEvent({ kind: "pull_request_review", payload });

      expect(event?.type).toBe("review_submitted");
      expect(event?.canonicalText).toContain("[approved]");
      expect(event?.canonicalText).toContain("LGTM");
    });
  });

  describe("commits", () => {
    it("canonicalizes a commit with stats and sha", () => {
      const commit: CommitLike = {
        sha: "abcdef1234567890",
        message: "Refactor pipeline",
        html_url: "https://github.com/org/repo/commit/abcdef1",
        timestamp: "2025-05-01T12:00:00Z",
        author: actor,
        stats: { additions: 5, deletions: 1, filesChanged: 2 },
      };

      const event = canonicalizeEvent({
        kind: "commit",
        payload: commit,
        repository: repo,
      });

      expect(event?.type).toBe("commit");
      expect(event?.canonicalText).toContain("Commit abcdef1");
      expect(event?.canonicalText).toContain("by alice");
      expect(event?.metrics).toEqual({ additions: 5, deletions: 1, filesChanged: 2 });
      expect(event?.ghId).toBe("abcdef1234567890");
    });

    it("returns null when actor is missing", () => {
      const commit: CommitLike = {
        sha: "123",
        timestamp: "2025-05-02T12:00:00Z",
      };

      const event = canonicalizeEvent({
        kind: "commit",
        payload: commit,
        repository: repo,
      });

      expect(event).toBeNull();
    });

    it("falls back to repo URL when commit URL is absent", () => {
      const commit: CommitLike = {
        sha: "789abc",
        message: "Fix",
        timestamp: "2025-05-03T12:00:00Z",
        author: actor,
      };

      const event = canonicalizeEvent({
        kind: "commit",
        payload: commit,
        repository: repo,
      });

      expect(event?.sourceUrl).toBe(repo.html_url);
    });
  });

  describe("timeline items", () => {
    it("canonicalizes timeline pull requests and respects state", () => {
      const event = canonicalizeEvent({
        kind: "timeline",
        repoFullName: "org/repo",
        item: {
          __typename: "PullRequest",
          id: "PR_timeline",
          number: 9,
          title: "Timeline PR",
          state: "closed",
          url: "https://github.com/org/repo/pull/9",
          updatedAt: "2025-06-01T00:00:00Z",
          actor: { login: "timelineUser" },
        },
      });

      expect(event?.type).toBe("pr_closed");
      expect(event?.repo.fullName).toBe("org/repo");
      expect(event?.actor.ghLogin).toBe("timelineUser");
    });
  });
});
