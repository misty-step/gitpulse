/**
 * Unit tests for GitHub GraphQL data transformers
 */

import {
  transformGraphQLCommit,
  transformGraphQLRepository,
  transformGraphQLCommits,
  getRepositoryFullName,
} from '../transformers';
import type { CommitNode } from '../queries';

describe('transformGraphQLCommit', () => {
  const repoFullName = 'facebook/react';

  // Helper to create a valid CommitNode with default values
  const createCommitNode = (overrides: Partial<CommitNode> = {}): CommitNode => ({
    oid: 'default-oid',
    committedDate: '2023-12-01T10:30:00Z',
    message: 'default message',
    messageHeadline: 'default message',
    messageBody: '',
    author: {
      name: 'Default Author',
      email: 'default@example.com',
      user: null,
    },
    committer: {
      name: 'Default Committer',
      email: 'committer@example.com',
      user: null,
    },
    repository: {
      nameWithOwner: repoFullName,
      id: 'R_kgDOB_default',
    },
    ...overrides,
  });

  it('should transform a complete GraphQL commit node to REST format', () => {
    const graphqlCommit = createCommitNode({
      oid: 'a1b2c3d4e5f6',
      message: 'feat: add new feature',
      messageHeadline: 'feat: add new feature',
      author: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        user: {
          login: 'janedoe',
          id: 'MDQ6VXNlcjEyMzQ1',
        },
      },
      committer: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        user: {
          login: 'janedoe',
          id: 'MDQ6VXNlcjEyMzQ1',
        },
      },
    });

    const result = transformGraphQLCommit(graphqlCommit, repoFullName);

    expect(result).toEqual({
      sha: 'a1b2c3d4e5f6',
      commit: {
        author: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          date: '2023-12-01T10:30:00Z',
        },
        committer: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          date: '2023-12-01T10:30:00Z',
        },
        message: 'feat: add new feature',
      },
      html_url: 'https://github.com/facebook/react/commit/a1b2c3d4e5f6',
      author: {
        login: 'janedoe',
        avatar_url: 'https://github.com/janedoe.png',
        type: 'User',
      },
      committer: {
        login: 'janedoe',
        avatar_url: 'https://github.com/janedoe.png',
        type: 'User',
      },
      repository: {
        full_name: 'facebook/react',
      },
    });
  });

  it('should handle commit with null author user (non-GitHub user)', () => {
    const graphqlCommit = createCommitNode({
      oid: 'abc123',
      message: 'fix: bug fix from external contributor',
      author: {
        name: 'External Contributor',
        email: 'external@example.com',
        user: null,
      },
    });

    const result = transformGraphQLCommit(graphqlCommit, repoFullName);

    expect(result.author).toBeNull();
    expect(result.commit.author).toEqual({
      name: 'External Contributor',
      email: 'external@example.com',
      date: '2023-12-01T10:30:00Z',
    });
  });

  it('should handle commit without GitHub user for committer', () => {
    const graphqlCommit = createCommitNode({
      oid: 'def456',
      message: 'chore: update dependencies',
      author: {
        name: 'John Smith',
        email: 'john@example.com',
        user: {
          login: 'johnsmith',
          id: 'MDQ6VXNlcjY3ODkw',
        },
      },
      committer: {
        name: 'Bot User',
        email: 'bot@example.com',
        user: null,
      },
    });

    const result = transformGraphQLCommit(graphqlCommit, repoFullName);

    // Committer should be undefined in the top-level (no GitHub user)
    expect(result.committer).toBeUndefined();
    // But commit.committer should exist with name/email
    expect(result.commit.committer).toBeDefined();
    expect(result.commit.committer?.name).toBe('Bot User');
  });

  it('should handle commit with missing author name and email', () => {
    const graphqlCommit = createCommitNode({
      oid: 'jkl012',
      message: 'refactor: code cleanup',
      author: {
        name: null,
        email: null,
        user: null,
      },
    });

    const result = transformGraphQLCommit(graphqlCommit, repoFullName);

    expect(result.commit.author).toEqual({
      name: undefined,
      email: undefined,
      date: graphqlCommit.committedDate,
    });
    expect(result.author).toBeNull();
  });

  it('should generate correct html_url for different repositories', () => {
    const graphqlCommit = createCommitNode({
      oid: 'xyz999',
      message: 'test commit',
    });

    const result1 = transformGraphQLCommit(graphqlCommit, 'microsoft/vscode');
    expect(result1.html_url).toBe('https://github.com/microsoft/vscode/commit/xyz999');

    const result2 = transformGraphQLCommit(graphqlCommit, 'torvalds/linux');
    expect(result2.html_url).toBe('https://github.com/torvalds/linux/commit/xyz999');
  });

  it('should preserve repository full name in result', () => {
    const graphqlCommit = createCommitNode({
      oid: 'test123',
      message: 'test',
    });

    const customRepo = 'custom-org/custom-repo';
    const result = transformGraphQLCommit(graphqlCommit, customRepo);

    expect(result.repository?.full_name).toBe(customRepo);
  });
});

describe('transformGraphQLRepository', () => {
  it('should transform a complete GraphQL repository node to REST format', () => {
    const graphqlRepo = {
      id: 'R_kgDOB_12345',
      nameWithOwner: 'facebook/react',
      owner: {
        login: 'facebook',
        avatarUrl: 'https://avatars.githubusercontent.com/u/69631?v=4',
      },
      isPrivate: false,
      url: 'https://github.com/facebook/react',
      description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
      updatedAt: '2023-12-01T10:30:00Z',
      primaryLanguage: {
        name: 'JavaScript',
      },
    };

    const result = transformGraphQLRepository(graphqlRepo);

    expect(result).toEqual({
      id: expect.any(Number),
      name: 'react',
      full_name: 'facebook/react',
      owner: {
        login: 'facebook',
        avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4',
        type: 'User',
      },
      private: false,
      html_url: 'https://github.com/facebook/react',
      description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
      updated_at: '2023-12-01T10:30:00Z',
      language: 'JavaScript',
    });
  });

  it('should handle repository with missing optional fields', () => {
    const graphqlRepo = {
      id: 'R_kgDOB_99999',
      nameWithOwner: 'test-user/test-repo',
    };

    const result = transformGraphQLRepository(graphqlRepo);

    expect(result.full_name).toBe('test-user/test-repo');
    expect(result.name).toBe('test-repo');
    expect(result.owner.login).toBe('test-user');
    expect(result.owner.avatar_url).toBeUndefined();
    expect(result.private).toBe(false);
    expect(result.html_url).toBe('https://github.com/test-user/test-repo');
    expect(result.description).toBeNull();
    expect(result.updated_at).toBeNull();
    expect(result.language).toBeNull();
  });

  it('should handle private repository', () => {
    const graphqlRepo = {
      id: 'R_kgDOB_54321',
      nameWithOwner: 'private-org/private-repo',
      isPrivate: true,
    };

    const result = transformGraphQLRepository(graphqlRepo);

    expect(result.private).toBe(true);
  });

  it('should parse owner from nameWithOwner when owner object is missing', () => {
    const graphqlRepo = {
      id: 'R_kgDOB_11111',
      nameWithOwner: 'some-org/some-repo',
    };

    const result = transformGraphQLRepository(graphqlRepo);

    expect(result.owner.login).toBe('some-org');
    expect(result.name).toBe('some-repo');
  });

  it('should handle repository name with slashes', () => {
    const graphqlRepo = {
      id: 'R_kgDOB_22222',
      nameWithOwner: 'org-name/nested/repo/name',
    };

    const result = transformGraphQLRepository(graphqlRepo);

    expect(result.owner.login).toBe('org-name');
    expect(result.name).toBe('nested/repo/name');
    expect(result.full_name).toBe('org-name/nested/repo/name');
  });

  it('should generate default html_url when url is not provided', () => {
    const graphqlRepo = {
      id: 'R_kgDOB_33333',
      nameWithOwner: 'user123/repo456',
    };

    const result = transformGraphQLRepository(graphqlRepo);

    expect(result.html_url).toBe('https://github.com/user123/repo456');
  });

  it('should handle repository without primary language', () => {
    const graphqlRepo = {
      id: 'R_kgDOB_44444',
      nameWithOwner: 'user/repo',
      primaryLanguage: undefined,
    };

    const result = transformGraphQLRepository(graphqlRepo);

    expect(result.language).toBeNull();
  });

  it('should extract numeric id from GraphQL node id', () => {
    const graphqlRepo1 = {
      id: 'R_kgDOB_12345',
      nameWithOwner: 'test/repo1',
    };

    const graphqlRepo2 = {
      id: 'MDEwOlJlcG9zaXRvcnk5ODc2NTQzMjE=',
      nameWithOwner: 'test/repo2',
    };

    const result1 = transformGraphQLRepository(graphqlRepo1);
    const result2 = transformGraphQLRepository(graphqlRepo2);

    expect(typeof result1.id).toBe('number');
    expect(typeof result2.id).toBe('number');
  });
});

describe('transformGraphQLCommits', () => {
  const repoFullName = 'org/repo';

  // Helper to create a valid CommitNode
  const createCommitNode = (overrides: Partial<CommitNode> = {}): CommitNode => ({
    oid: 'default-oid',
    committedDate: '2023-12-01T10:30:00Z',
    message: 'default message',
    messageHeadline: 'default message',
    messageBody: '',
    author: {
      name: 'Default Author',
      email: 'default@example.com',
      user: null,
    },
    committer: {
      name: 'Default Committer',
      email: 'committer@example.com',
      user: null,
    },
    repository: {
      nameWithOwner: repoFullName,
      id: 'R_kgDOB_default',
    },
    ...overrides,
  });

  it('should transform an array of GraphQL commits', () => {
    const commits: CommitNode[] = [
      createCommitNode({
        oid: 'commit1',
        committedDate: '2023-12-01T10:00:00Z',
        message: 'First commit',
        author: {
          name: 'User One',
          email: 'user1@example.com',
          user: { login: 'user1', id: 'MDQ6VXNlcjEyMzQ1' },
        },
      }),
      createCommitNode({
        oid: 'commit2',
        committedDate: '2023-12-01T11:00:00Z',
        message: 'Second commit',
        author: {
          name: 'User Two',
          email: 'user2@example.com',
          user: { login: 'user2', id: 'MDQ6VXNlcjY3ODkw' },
        },
      }),
    ];

    const result = transformGraphQLCommits(commits, repoFullName);

    expect(result).toHaveLength(2);
    expect(result[0].sha).toBe('commit1');
    expect(result[1].sha).toBe('commit2');
    expect(result[0].repository?.full_name).toBe(repoFullName);
    expect(result[1].repository?.full_name).toBe(repoFullName);
  });

  it('should handle empty array', () => {
    const result = transformGraphQLCommits([], 'org/repo');

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });
});

describe('getRepositoryFullName', () => {
  it('should extract repository full name from node', () => {
    const node = { nameWithOwner: 'facebook/react' };

    const result = getRepositoryFullName(node);

    expect(result).toBe('facebook/react');
  });

  it('should handle different repository names', () => {
    expect(getRepositoryFullName({ nameWithOwner: 'microsoft/vscode' })).toBe('microsoft/vscode');
    expect(getRepositoryFullName({ nameWithOwner: 'torvalds/linux' })).toBe('torvalds/linux');
    expect(getRepositoryFullName({ nameWithOwner: 'a/b' })).toBe('a/b');
  });
});