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
});