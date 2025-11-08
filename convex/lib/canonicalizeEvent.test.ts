import { canonicalizeEvent, CanonicalizeInput } from "./canonicalizeEvent";
import { computeContentHash } from "./contentHash";

describe("canonicalizeEvent", () => {
  const repo = {
    id: 42,
    node_id: "R_kgDOExample",
    name: "gitpulse",
    full_name: "acme/gitpulse",
    html_url: "https://github.com/acme/gitpulse",
    owner: { id: 7, login: "acme", node_id: "MDQ6VXNlcjE=" },
  };

  it("normalizes pull request opened events", () => {
    const payload: CanonicalizeInput = {
      kind: "pull_request",
      payload: {
        action: "opened",
        pull_request: {
          id: 99,
          node_id: "PR_kwDOExample",
          number: 123,
          title: "Add ingestion queue",
          html_url: "https://github.com/acme/gitpulse/pull/123",
          created_at: "2025-11-01T10:00:00Z",
          updated_at: "2025-11-01T10:05:00Z",
          merged: false,
          additions: 120,
          deletions: 10,
          changed_files: 3,
          base: { ref: "main" },
          head: { ref: "feat/ingestion" },
          user: { id: 8, login: "devin", node_id: "U_kgDEVIN" },
        },
        repository: repo,
        sender: { id: 8, login: "devin" },
      },
    };

    const result = canonicalizeEvent(payload);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("pr_opened");
    expect(result?.repo.fullName).toBe("acme/gitpulse");
    expect(result?.actor.ghLogin).toBe("devin");
    expect(result?.metrics).toEqual({ additions: 120, deletions: 10, filesChanged: 3 });
    expect(result?.canonicalText).toContain("PR #123");
    expect(result?.canonicalText).toContain("opened");
  });

  it("maps closed merged pull requests to pr_merged", () => {
    const payload: CanonicalizeInput = {
      kind: "pull_request",
      payload: {
        action: "closed",
        pull_request: {
          id: 100,
          node_id: "PR_kwDOExample2",
          number: 5,
          title: "Ship coverage meter",
          html_url: "https://github.com/acme/gitpulse/pull/5",
          merged: true,
          merged_at: "2025-11-02T12:00:00Z",
          updated_at: "2025-11-02T11:59:00Z",
          closed_at: "2025-11-02T11:59:00Z",
          additions: 12,
          deletions: 2,
          changed_files: 1,
          user: { id: 3, login: "alix" },
        },
        repository: repo,
        sender: { id: 9, login: "maintainer" },
      },
    };

    const result = canonicalizeEvent(payload);
    expect(result?.type).toBe("pr_merged");
    expect(result?.ts).toBe(Date.parse("2025-11-02T12:00:00Z"));
    expect(result?.metadata).toMatchObject({ number: 5, merged: true });
  });

  it("produces review_submitted events", () => {
    const payload: CanonicalizeInput = {
      kind: "pull_request_review",
      payload: {
        action: "submitted",
        review: {
          id: 321,
          node_id: "RE_kwDOExample",
          state: "APPROVED",
          body: "Looks great!",
          html_url: "https://github.com/acme/gitpulse/pull/5#pullrequestreview-321",
          submitted_at: "2025-11-03T09:00:00Z",
          user: { id: 7, login: "reviewer" },
        },
        pull_request: {
          number: 5,
          html_url: "https://github.com/acme/gitpulse/pull/5",
          updated_at: "2025-11-03T08:59:00Z",
        },
        repository: repo,
      },
    };

    const result = canonicalizeEvent(payload);
    expect(result?.type).toBe("review_submitted");
    expect(result?.canonicalText).toContain("Review on PR #5");
    expect(result?.canonicalText).toContain("APPROVED");
  });

  it("handles issue comments with snippets", () => {
    const payload: CanonicalizeInput = {
      kind: "issue_comment",
      payload: {
        action: "created",
        issue: {
          id: 77,
          node_id: "I_kwDOExample",
          number: 88,
          title: "Bug: webhook fails",
          html_url: "https://github.com/acme/gitpulse/issues/88",
          updated_at: "2025-11-04T00:00:00Z",
          user: { id: 1, login: "alice" },
        },
        comment: {
          id: 555,
          node_id: "IC_kwDOExample",
          body: "Can reproduce on latest build.",
          html_url: "https://github.com/acme/gitpulse/issues/88#issuecomment-555",
          created_at: "2025-11-04T00:05:00Z",
          user: { id: 2, login: "bob" },
        },
        repository: repo,
        sender: { id: 2, login: "bob" },
      },
    };

    const result = canonicalizeEvent(payload);
    expect(result?.type).toBe("issue_comment");
    expect(result?.canonicalText).toContain("Comment on issue #88");
    expect(result?.actor.ghLogin).toBe("bob");
  });

  it("builds commit events from push commits", () => {
    const payload: CanonicalizeInput = {
      kind: "commit",
      payload: {
        id: "abcd1234",
        message: "Refactor canonicalizer",
        timestamp: "2025-11-05T10:00:00Z",
        url: "https://github.com/acme/gitpulse/commit/abcd1234",
        author: {
          name: "casey",
          email: "casey@example.com",
        },
        stats: { additions: 50, deletions: 10, filesChanged: 4 },
      },
      repository: repo,
    };

    const result = canonicalizeEvent(payload);
    expect(result?.type).toBe("commit");
    expect(result?.metrics).toEqual({ additions: 50, deletions: 10, filesChanged: 4 });
    expect(result?.canonicalText).toContain("Commit abcd123");
  });

  it("returns null when actor missing", () => {
    const payload: CanonicalizeInput = {
      kind: "pull_request",
      payload: {
        action: "opened",
        pull_request: {
          id: 1,
          node_id: "PR_kwDOExample3",
          number: 1,
          title: "Missing sender",
          html_url: "https://github.com/acme/gitpulse/pull/1",
          created_at: "2025-11-01T00:00:00Z",
          user: undefined,
        },
        repository: repo,
        sender: undefined,
      },
    };

    expect(canonicalizeEvent(payload)).toBeNull();
  });

  it("converts timeline search items", () => {
    const payload: CanonicalizeInput = {
      kind: "timeline",
      item: {
        __typename: "PullRequest",
        id: "PR_kwDOBRK",
        number: 9,
        title: "Timeline PR",
        state: "closed",
        url: "https://github.com/acme/gitpulse/pull/9",
        updatedAt: "2025-11-06T12:00:00Z",
        actor: { login: "devin" },
      },
      repoFullName: "acme/gitpulse",
    };

    const result = canonicalizeEvent(payload);
    expect(result?.type).toBe("pr_closed");
    expect(result?.metadata).toMatchObject({ timeline: true });
  });

  it("produces deterministic content hashes regardless of metrics ordering", () => {
    const hashA = computeContentHash({
      canonicalText: "PR #1 opened by devin",
      sourceUrl: "https://github.com/acme/gitpulse/pull/1",
      metrics: { additions: 10, deletions: 2 },
    });
    const hashB = computeContentHash({
      canonicalText: "PR #1 opened by devin",
      sourceUrl: "https://github.com/acme/gitpulse/pull/1",
      metrics: { deletions: 2, additions: 10 },
    });

    expect(hashA).toBe(hashB);
  });
});
