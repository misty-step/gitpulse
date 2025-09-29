/**
 * Unit tests for GitHub GraphQL client - fetchCommitsGraphQL method
 */

import { GitHubGraphQLClient } from '../client';
import { GraphQLClient } from 'graphql-request';

// Mock graphql-request module
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

// Mock logger
jest.mock('../../../logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('GitHubGraphQLClient - fetchCommitsGraphQL', () => {
  const mockAccessToken = 'test-github-token-12345';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch commits from a single repository with 50 commits', async () => {
    const nodeIds = ['node_id_repo1'];
    const since = '2024-01-01T00:00:00Z';
    const until = '2024-01-31T23:59:59Z';

    // Generate 50 mock commits
    const mockCommits = Array.from({ length: 50 }, (_, i) => ({
      oid: `commit_sha_${i}`,
      committedDate: '2024-01-15T10:00:00Z',
      message: `Commit message ${i}`,
      messageHeadline: `Commit message ${i}`,
      messageBody: '',
      author: {
        name: 'Test Author',
        email: 'test@example.com',
        user: {
          login: 'testauthor',
          id: 'user_id_1',
        },
      },
      committer: {
        name: 'Test Author',
        email: 'test@example.com',
        user: {
          login: 'testauthor',
          id: 'user_id_1',
        },
      },
      repository: {
        nameWithOwner: 'facebook/react',
        id: 'node_id_repo1',
      },
    }));

    const mockRequest = jest.fn().mockResolvedValue({
      rateLimit: {
        cost: 1,
        remaining: 4999,
        resetAt: '2024-01-01T01:00:00Z',
      },
      repo0: {
        id: 'node_id_repo1',
        nameWithOwner: 'facebook/react',
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              nodes: mockCommits,
            },
          },
        },
      },
    });

    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL(nodeIds, since, until);

    // Should return all 50 commits
    expect(commits).toHaveLength(50);

    // Verify transformation to Commit interface
    expect(commits[0]).toMatchObject({
      sha: 'commit_sha_0',
      commit: {
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          date: '2024-01-15T10:00:00Z',
        },
        message: 'Commit message 0',
      },
      html_url: 'https://github.com/facebook/react/commit/commit_sha_0',
      author: {
        login: 'testauthor',
        avatar_url: 'https://github.com/testauthor.png',
        type: 'User',
      },
      repository: {
        full_name: 'facebook/react',
      },
    });

    // Should have called the API once
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('should handle pagination for repository with 150 commits', async () => {
    const nodeIds = ['node_id_repo1'];
    const since = '2024-01-01T00:00:00Z';
    const until = '2024-01-31T23:59:59Z';

    // Helper to generate mock commits
    const generateCommits = (start: number, count: number) =>
      Array.from({ length: count }, (_, i) => ({
        oid: `commit_sha_${start + i}`,
        committedDate: '2024-01-15T10:00:00Z',
        message: `Commit message ${start + i}`,
        messageHeadline: `Commit message ${start + i}`,
        messageBody: '',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          user: {
            login: 'testauthor',
            id: 'user_id_1',
          },
        },
        committer: {
          name: 'Test Author',
          email: 'test@example.com',
          user: {
            login: 'testauthor',
            id: 'user_id_1',
          },
        },
        repository: {
          nameWithOwner: 'facebook/react',
          id: 'node_id_repo1',
        },
      }));

    const mockRequest = jest.fn()
      // First call: 100 commits with hasNextPage=true
      .mockResolvedValueOnce({
        rateLimit: {
          cost: 1,
          remaining: 4999,
          resetAt: '2024-01-01T01:00:00Z',
        },
        repo0: {
          id: 'node_id_repo1',
          nameWithOwner: 'facebook/react',
          defaultBranchRef: {
            target: {
              history: {
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor_page_1',
                },
                nodes: generateCommits(0, 100),
              },
            },
          },
        },
      })
      // Second call: 50 more commits with hasNextPage=false
      .mockResolvedValueOnce({
        rateLimit: {
          cost: 1,
          remaining: 4998,
          resetAt: '2024-01-01T01:00:00Z',
        },
        repo0: {
          id: 'node_id_repo1',
          nameWithOwner: 'facebook/react',
          defaultBranchRef: {
            target: {
              history: {
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: generateCommits(100, 50),
              },
            },
          },
        },
      });

    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL(nodeIds, since, until);

    // Should return all 150 commits (100 + 50)
    expect(commits).toHaveLength(150);

    // Verify first and last commits
    expect(commits[0].sha).toBe('commit_sha_0');
    expect(commits[149].sha).toBe('commit_sha_149');

    // Should have called the API twice (initial + 1 pagination)
    expect(mockRequest).toHaveBeenCalledTimes(2);

    // Verify second call used the cursor
    const secondCallVariables = mockRequest.mock.calls[1][1];
    expect(secondCallVariables.after0).toBe('cursor_page_1');
  });

  it('should filter commits by author email', async () => {
    const nodeIds = ['node_id_repo1'];
    const since = '2024-01-01T00:00:00Z';
    const until = '2024-01-31T23:59:59Z';
    const authorEmail = 'specific@example.com';

    const mockCommits = Array.from({ length: 10 }, (_, i) => ({
      oid: `commit_sha_${i}`,
      committedDate: '2024-01-15T10:00:00Z',
      message: `Commit message ${i}`,
      messageHeadline: `Commit message ${i}`,
      messageBody: '',
      author: {
        name: 'Specific Author',
        email: authorEmail,
        user: {
          login: 'specificauthor',
          id: 'user_id_1',
        },
      },
      committer: {
        name: 'Specific Author',
        email: authorEmail,
        user: {
          login: 'specificauthor',
          id: 'user_id_1',
        },
      },
      repository: {
        nameWithOwner: 'facebook/react',
        id: 'node_id_repo1',
      },
    }));

    const mockRequest = jest.fn().mockResolvedValue({
      rateLimit: {
        cost: 1,
        remaining: 4999,
        resetAt: '2024-01-01T01:00:00Z',
      },
      repo0: {
        id: 'node_id_repo1',
        nameWithOwner: 'facebook/react',
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              nodes: mockCommits,
            },
          },
        },
      },
    });

    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL(nodeIds, since, until, authorEmail);

    // Should return filtered commits
    expect(commits).toHaveLength(10);

    // Verify all commits are from the specified author
    commits.forEach(commit => {
      expect(commit.commit.author?.email).toBe(authorEmail);
    });

    // Verify author filter was passed to the query
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const callVariables = mockRequest.mock.calls[0][1];
    expect(callVariables.author).toEqual({ emails: [authorEmail] });
  });

  it('should handle repositories with no commits', async () => {
    const nodeIds = ['node_id_repo1'];
    const since = '2024-01-01T00:00:00Z';
    const until = '2024-01-31T23:59:59Z';

    const mockRequest = jest.fn().mockResolvedValue({
      rateLimit: {
        cost: 1,
        remaining: 4999,
        resetAt: '2024-01-01T01:00:00Z',
      },
      repo0: {
        id: 'node_id_repo1',
        nameWithOwner: 'facebook/react',
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              nodes: [],
            },
          },
        },
      },
    });

    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL(nodeIds, since, until);

    expect(commits).toHaveLength(0);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('should handle repositories with null defaultBranchRef', async () => {
    const nodeIds = ['node_id_repo1'];
    const since = '2024-01-01T00:00:00Z';
    const until = '2024-01-31T23:59:59Z';

    const mockRequest = jest.fn().mockResolvedValue({
      rateLimit: {
        cost: 1,
        remaining: 4999,
        resetAt: '2024-01-01T01:00:00Z',
      },
      repo0: {
        id: 'node_id_repo1',
        nameWithOwner: 'facebook/react',
        defaultBranchRef: null, // Empty repository or no default branch
      },
    });

    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL(nodeIds, since, until);

    expect(commits).toHaveLength(0);
  });

  it('should handle commits with null author.user (non-GitHub users)', async () => {
    const nodeIds = ['node_id_repo1'];
    const since = '2024-01-01T00:00:00Z';
    const until = '2024-01-31T23:59:59Z';

    const mockCommits = [
      {
        oid: 'commit_sha_1',
        committedDate: '2024-01-15T10:00:00Z',
        message: 'Commit by non-GitHub user',
        messageHeadline: 'Commit by non-GitHub user',
        messageBody: '',
        author: {
          name: 'External Author',
          email: 'external@example.com',
          user: null, // Not a GitHub user
        },
        committer: {
          name: 'External Author',
          email: 'external@example.com',
          user: null,
        },
        repository: {
          nameWithOwner: 'facebook/react',
          id: 'node_id_repo1',
        },
      },
    ];

    const mockRequest = jest.fn().mockResolvedValue({
      rateLimit: {
        cost: 1,
        remaining: 4999,
        resetAt: '2024-01-01T01:00:00Z',
      },
      repo0: {
        id: 'node_id_repo1',
        nameWithOwner: 'facebook/react',
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              nodes: mockCommits,
            },
          },
        },
      },
    });

    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL(nodeIds, since, until);

    expect(commits).toHaveLength(1);

    // Verify author is null when user is null
    expect(commits[0].author).toBeNull();
    expect(commits[0].committer).toBeUndefined();

    // But commit.author should still have name and email
    expect(commits[0].commit.author?.name).toBe('External Author');
    expect(commits[0].commit.author?.email).toBe('external@example.com');
  });

  it('should return empty array for empty node IDs', async () => {
    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL([], '2024-01-01', '2024-01-31');

    expect(commits).toHaveLength(0);
  });

  it('should batch multiple repositories correctly', async () => {
    const nodeIds = ['node_id_repo1', 'node_id_repo2'];
    const since = '2024-01-01T00:00:00Z';
    const until = '2024-01-31T23:59:59Z';

    const mockRequest = jest.fn().mockResolvedValue({
      rateLimit: {
        cost: 1,
        remaining: 4999,
        resetAt: '2024-01-01T01:00:00Z',
      },
      repo0: {
        id: 'node_id_repo1',
        nameWithOwner: 'facebook/react',
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              nodes: [{
                oid: 'commit_sha_1',
                committedDate: '2024-01-15T10:00:00Z',
                message: 'Commit from repo1',
                messageHeadline: 'Commit from repo1',
                messageBody: '',
                author: {
                  name: 'Author 1',
                  email: 'author1@example.com',
                  user: { login: 'author1', id: 'user_id_1' },
                },
                committer: {
                  name: 'Author 1',
                  email: 'author1@example.com',
                  user: { login: 'author1', id: 'user_id_1' },
                },
                repository: {
                  nameWithOwner: 'facebook/react',
                  id: 'node_id_repo1',
                },
              }],
            },
          },
        },
      },
      repo1: {
        id: 'node_id_repo2',
        nameWithOwner: 'vercel/next.js',
        defaultBranchRef: {
          target: {
            history: {
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
              nodes: [{
                oid: 'commit_sha_2',
                committedDate: '2024-01-16T10:00:00Z',
                message: 'Commit from repo2',
                messageHeadline: 'Commit from repo2',
                messageBody: '',
                author: {
                  name: 'Author 2',
                  email: 'author2@example.com',
                  user: { login: 'author2', id: 'user_id_2' },
                },
                committer: {
                  name: 'Author 2',
                  email: 'author2@example.com',
                  user: { login: 'author2', id: 'user_id_2' },
                },
                repository: {
                  nameWithOwner: 'vercel/next.js',
                  id: 'node_id_repo2',
                },
              }],
            },
          },
        },
      },
    });

    (GraphQLClient as jest.Mock).mockImplementation(() => ({
      request: mockRequest,
    }));

    const client = new GitHubGraphQLClient(mockAccessToken);
    const commits = await client.fetchCommitsGraphQL(nodeIds, since, until);

    // Should return commits from both repositories
    expect(commits).toHaveLength(2);
    expect(commits[0].repository?.full_name).toBe('facebook/react');
    expect(commits[1].repository?.full_name).toBe('vercel/next.js');

    // Should have called the API once (both in same batch)
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });
});