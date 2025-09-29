/**
 * Unit tests for GitHub GraphQL client
 */

import { GitHubGraphQLClient, createGitHubGraphQLClient } from '../client';
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

describe('GitHubGraphQLClient', () => {
  const mockAccessToken = 'test-github-token-12345';
  const expectedEndpoint = 'https://api.github.com/graphql';

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear the module-level cache before each test
    const client = new GitHubGraphQLClient(mockAccessToken);
    client.clearRepositoryIdCache();
  });

  describe('Constructor', () => {
    it('should instantiate successfully with a valid access token', () => {
      const client = new GitHubGraphQLClient(mockAccessToken);
      expect(client).toBeInstanceOf(GitHubGraphQLClient);
    });

    it('should throw an error when access token is not provided', () => {
      expect(() => new GitHubGraphQLClient('')).toThrow('GitHub access token is required');
      expect(() => new GitHubGraphQLClient(null as any)).toThrow('GitHub access token is required');
      expect(() => new GitHubGraphQLClient(undefined as any)).toThrow('GitHub access token is required');
    });

    it('should create GraphQLClient with correct endpoint', () => {
      new GitHubGraphQLClient(mockAccessToken);

      expect(GraphQLClient).toHaveBeenCalledWith(
        expectedEndpoint,
        expect.any(Object)
      );
    });
  });

  describe('Headers configuration', () => {
    it('should set correct headers including Authorization and X-Github-Next-Global-ID', () => {
      new GitHubGraphQLClient(mockAccessToken);

      expect(GraphQLClient).toHaveBeenCalledWith(
        expectedEndpoint,
        {
          headers: {
            'Authorization': `Bearer ${mockAccessToken}`,
            'X-Github-Next-Global-ID': '1',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );
    });

    it('should include Bearer prefix in Authorization header', () => {
      new GitHubGraphQLClient(mockAccessToken);

      const callArgs = (GraphQLClient as jest.Mock).mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['Authorization']).toBe(`Bearer ${mockAccessToken}`);
      expect(headers['Authorization']).toMatch(/^Bearer /);
    });

    it('should set X-Github-Next-Global-ID header to "1" for new ID format support', () => {
      new GitHubGraphQLClient(mockAccessToken);

      const callArgs = (GraphQLClient as jest.Mock).mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['X-Github-Next-Global-ID']).toBe('1');
    });

    it('should include standard JSON content headers', () => {
      new GitHubGraphQLClient(mockAccessToken);

      const callArgs = (GraphQLClient as jest.Mock).mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Accept']).toBe('application/json');
    });
  });

  describe('query method', () => {
    it('should execute GraphQL queries successfully', async () => {
      const mockResponse = { data: { viewer: { login: 'testuser' } } };
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const query = '{ viewer { login } }';
      const result = await client.query(query);

      expect(mockRequest).toHaveBeenCalledWith(query, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should pass variables to GraphQL queries', async () => {
      const mockResponse = { data: { repository: { name: 'test-repo' } } };
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const query = 'query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { name } }';
      const variables = { owner: 'testuser', name: 'test-repo' };

      const result = await client.query(query, variables);

      expect(mockRequest).toHaveBeenCalledWith(query, variables);
      expect(result).toEqual(mockResponse);
    });

    it('should handle rate limit errors (403)', async () => {
      const rateLimitError = {
        response: {
          status: 403,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1234567890',
          },
          errors: [{ message: 'API rate limit exceeded' }],
        },
        message: 'API rate limit exceeded',
      };

      const mockRequest = jest.fn().mockRejectedValue(rateLimitError);
      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const query = '{ viewer { login } }';

      await expect(client.query(query)).rejects.toEqual(rateLimitError);
    });

    it('should handle rate limit errors (429)', async () => {
      const rateLimitError = {
        response: {
          status: 429,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1234567890',
          },
          errors: [{ message: 'Too many requests' }],
        },
        message: 'Too many requests',
      };

      const mockRequest = jest.fn().mockRejectedValue(rateLimitError);
      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const query = '{ viewer { login } }';

      await expect(client.query(query)).rejects.toEqual(rateLimitError);
    });
  });

  describe('mutate method', () => {
    it('should execute GraphQL mutations successfully', async () => {
      const mockResponse = { data: { createIssue: { id: '123', title: 'Test Issue' } } };
      const mockRequest = jest.fn().mockResolvedValue(mockResponse);

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const mutation = 'mutation($input: CreateIssueInput!) { createIssue(input: $input) { id title } }';
      const variables = { input: { title: 'Test Issue', body: 'Test body' } };

      const result = await client.mutate(mutation, variables);

      expect(mockRequest).toHaveBeenCalledWith(mutation, variables);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getRateLimit method', () => {
    it('should fetch rate limit information', async () => {
      const mockRateLimitResponse = {
        rateLimit: {
          cost: 1,
          remaining: 4999,
          resetAt: '2024-01-01T00:00:00Z',
        },
      };

      const mockRequest = jest.fn().mockResolvedValue(mockRateLimitResponse);
      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const rateLimit = await client.getRateLimit();

      expect(mockRequest).toHaveBeenCalled();
      const query = mockRequest.mock.calls[0][0];
      expect(query).toContain('rateLimit');
      expect(query).toContain('cost');
      expect(query).toContain('remaining');
      expect(query).toContain('resetAt');
      expect(rateLimit).toEqual(mockRateLimitResponse.rateLimit);
    });
  });

  describe('updateAccessToken method', () => {
    it('should update the access token and recreate the client', () => {
      const client = new GitHubGraphQLClient(mockAccessToken);

      // Clear mock to track new instantiation
      jest.clearAllMocks();

      const newToken = 'new-test-token-67890';
      client.updateAccessToken(newToken);

      // Should create a new GraphQLClient instance with the new token
      expect(GraphQLClient).toHaveBeenCalledWith(
        expectedEndpoint,
        {
          headers: {
            'Authorization': `Bearer ${newToken}`,
            'X-Github-Next-Global-ID': '1',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        }
      );
    });

    it('should throw an error when new access token is not provided', () => {
      const client = new GitHubGraphQLClient(mockAccessToken);

      expect(() => client.updateAccessToken('')).toThrow('New access token is required');
      expect(() => client.updateAccessToken(null as any)).toThrow('New access token is required');
      expect(() => client.updateAccessToken(undefined as any)).toThrow('New access token is required');
    });
  });

  describe('createGitHubGraphQLClient factory function', () => {
    it('should create a GitHubGraphQLClient instance', () => {
      const client = createGitHubGraphQLClient(mockAccessToken);

      expect(client).toBeInstanceOf(GitHubGraphQLClient);
      expect(GraphQLClient).toHaveBeenCalledWith(
        expectedEndpoint,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockAccessToken}`,
          }),
        })
      );
    });
  });

  describe('resolveRepositoryIds', () => {
    it('should handle 100 repositories across multiple batches', async () => {
      // Generate 100 test repositories
      const repos: string[] = [];
      for (let i = 0; i < 100; i++) {
        repos.push(`org${Math.floor(i / 10)}/repo${i}`);
      }

      // Mock the GraphQL responses for each batch (50 repos per batch)
      const mockRequest = jest.fn()
        .mockResolvedValueOnce(
          // First batch: repos 0-49
          Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [
              `repo${i}`,
              { id: `node_id_${i}` }
            ])
          )
        )
        .mockResolvedValueOnce(
          // Second batch: repos 50-99
          Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [
              `repo${i}`,
              { id: `node_id_${i + 50}` }
            ])
          )
        );

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const result = await client.resolveRepositoryIds(repos);

      // Should have called the API twice (2 batches of 50)
      expect(mockRequest).toHaveBeenCalledTimes(2);

      // Should return all 100 repository IDs
      expect(result.size).toBe(100);

      // Verify a sample of the results
      expect(result.get('org0/repo0')).toBe('node_id_0');
      expect(result.get('org5/repo55')).toBe('node_id_55');
      expect(result.get('org9/repo99')).toBe('node_id_99');
    });

    it('should handle missing repositories gracefully', async () => {
      const repos = [
        'facebook/react',
        'private-org/private-repo',  // Will be null
        'microsoft/vscode',
        'deleted-org/deleted-repo',  // Will be null
        'google/guava',
      ];

      // Mock response with some null entries
      const mockRequest = jest.fn().mockResolvedValue({
        repo0: { id: 'node_id_react' },
        repo1: null,  // Private/inaccessible repository
        repo2: { id: 'node_id_vscode' },
        repo3: null,  // Deleted repository
        repo4: { id: 'node_id_guava' },
      });

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const result = await client.resolveRepositoryIds(repos);

      // Should only return the 3 accessible repositories
      expect(result.size).toBe(3);
      expect(result.get('facebook/react')).toBe('node_id_react');
      expect(result.get('microsoft/vscode')).toBe('node_id_vscode');
      expect(result.get('google/guava')).toBe('node_id_guava');

      // Missing repositories should not be in the result
      expect(result.has('private-org/private-repo')).toBe(false);
      expect(result.has('deleted-org/deleted-repo')).toBe(false);
    });

    it('should use cache for previously resolved repository IDs', async () => {
      const repos = ['facebook/react', 'microsoft/vscode'];

      const mockRequest = jest.fn().mockResolvedValue({
        repo0: { id: 'node_id_react' },
        repo1: { id: 'node_id_vscode' },
      });

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      // Clear cache to ensure clean state
      client.clearRepositoryIdCache();

      // First call should fetch from API
      const result1 = await client.resolveRepositoryIds(repos);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(result1.size).toBe(2);

      // Second call should use cache and not call API again
      mockRequest.mockClear();
      const result2 = await client.resolveRepositoryIds(repos);
      expect(mockRequest).toHaveBeenCalledTimes(0);
      expect(result2.size).toBe(2);
      expect(result2.get('facebook/react')).toBe('node_id_react');
    });

    it('should retry on transient failures up to 3 times', async () => {
      const repos = ['facebook/react'];

      // Mock to fail twice then succeed
      const mockRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          repo0: { id: 'node_id_react' },
        });

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      // Clear cache to ensure clean state
      client.clearRepositoryIdCache();

      const result = await client.resolveRepositoryIds(repos);

      // Should have retried 3 times total (2 failures + 1 success)
      expect(mockRequest).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(1);
      expect(result.get('facebook/react')).toBe('node_id_react');
    });

    it('should throw error after 3 failed attempts', async () => {
      const repos = ['facebook/react'];

      // Mock to fail all 3 times
      const mockRequest = jest.fn()
        .mockRejectedValue(new Error('Persistent network error'));

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      // Clear cache to ensure clean state
      client.clearRepositoryIdCache();

      await expect(client.resolveRepositoryIds(repos)).rejects.toThrow(
        'Failed to resolve repository IDs after 3 attempts'
      );

      expect(mockRequest).toHaveBeenCalledTimes(3);
    });

    it('should return empty map for empty input', async () => {
      const client = new GitHubGraphQLClient(mockAccessToken);
      const result = await client.resolveRepositoryIds([]);

      expect(result.size).toBe(0);
    });

    it('should skip repositories with invalid format', async () => {
      const repos = [
        'facebook/react',
        'invalid-repo-name',  // Missing owner/name separator
        'microsoft/vscode',
        'too/many/slashes',   // Too many parts
      ];

      const mockRequest = jest.fn().mockResolvedValue({
        repo0: { id: 'node_id_react' },
        repo1: { id: 'node_id_vscode' },
      });

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      const result = await client.resolveRepositoryIds(repos);

      // Should only process the 2 valid repositories
      expect(result.size).toBe(2);
      expect(result.get('facebook/react')).toBe('node_id_react');
      expect(result.get('microsoft/vscode')).toBe('node_id_vscode');
    });
  });

  describe('clearRepositoryIdCache', () => {
    it('should clear the repository ID cache', async () => {
      const repos = ['facebook/react'];

      const mockRequest = jest.fn().mockResolvedValue({
        repo0: { id: 'node_id_react' },
      });

      (GraphQLClient as jest.Mock).mockImplementation(() => ({
        request: mockRequest,
      }));

      const client = new GitHubGraphQLClient(mockAccessToken);
      // Start with clean cache
      client.clearRepositoryIdCache();

      // First call should fetch from API
      await client.resolveRepositoryIds(repos);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      // Clear cache
      client.clearRepositoryIdCache();

      // Next call should fetch from API again (cache was cleared)
      mockRequest.mockClear();
      await client.resolveRepositoryIds(repos);
      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });
});