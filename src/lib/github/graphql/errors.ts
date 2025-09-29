/**
 * Custom error classes for GitHub GraphQL API interactions
 *
 * Provides structured error handling with specific error codes
 * for different failure scenarios.
 */

/**
 * Error codes for GitHub GraphQL API errors
 */
export enum GraphQLErrorCode {
  /** Rate limit exceeded - API quota exhausted */
  RATE_LIMITED = 'RATE_LIMITED',

  /** Node limit exceeded - too many nodes requested in single query */
  NODE_LIMIT_EXCEEDED = 'NODE_LIMIT_EXCEEDED',

  /** Authentication failed - invalid or expired token */
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',

  /** Resource not found - repository or resource doesn't exist or not accessible */
  NOT_FOUND = 'NOT_FOUND',

  /** Network error - connection failed or timed out */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Malformed query - GraphQL syntax or structure error */
  MALFORMED_QUERY = 'MALFORMED_QUERY',

  /** Unknown error - catch-all for unexpected failures */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Custom error class for GitHub GraphQL API errors
 *
 * Extends the standard Error class with additional context
 * including error codes, HTTP status, and original error details.
 */
export class GraphQLError extends Error {
  /** Error code identifying the type of failure */
  public readonly code: GraphQLErrorCode;

  /** HTTP status code from the API response (if available) */
  public readonly statusCode?: number;

  /** Original error object from the GraphQL client */
  public readonly originalError?: Error;

  /** Additional context about the error */
  public readonly context?: Record<string, any>;

  /** Rate limit information (if applicable) */
  public readonly rateLimit?: {
    remaining: number;
    reset: string;
    limit: number;
  };

  constructor(
    message: string,
    code: GraphQLErrorCode = GraphQLErrorCode.UNKNOWN,
    options?: {
      statusCode?: number;
      originalError?: Error;
      context?: Record<string, any>;
      rateLimit?: {
        remaining: number;
        reset: string;
        limit: number;
      };
    }
  ) {
    super(message);

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphQLError);
    }

    this.name = 'GraphQLError';
    this.code = code;
    this.statusCode = options?.statusCode;
    this.originalError = options?.originalError;
    this.context = options?.context;
    this.rateLimit = options?.rateLimit;
  }

  /**
   * Check if this is a rate limit error
   */
  isRateLimitError(): boolean {
    return this.code === GraphQLErrorCode.RATE_LIMITED;
  }

  /**
   * Check if this is a node limit error
   */
  isNodeLimitError(): boolean {
    return this.code === GraphQLErrorCode.NODE_LIMIT_EXCEEDED;
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return this.code === GraphQLErrorCode.AUTHENTICATION_FAILED;
  }

  /**
   * Check if this error is recoverable (can retry)
   */
  isRecoverable(): boolean {
    return this.code === GraphQLErrorCode.RATE_LIMITED ||
           this.code === GraphQLErrorCode.NETWORK_ERROR;
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case GraphQLErrorCode.RATE_LIMITED:
        return 'GitHub API rate limit exceeded. Please try again later.';
      case GraphQLErrorCode.NODE_LIMIT_EXCEEDED:
        return 'Too many repositories requested at once. Please reduce the number of repositories.';
      case GraphQLErrorCode.AUTHENTICATION_FAILED:
        return 'GitHub authentication failed. Please sign in again.';
      case GraphQLErrorCode.NOT_FOUND:
        return 'Repository not found or not accessible.';
      case GraphQLErrorCode.NETWORK_ERROR:
        return 'Network error occurred. Please check your connection and try again.';
      case GraphQLErrorCode.MALFORMED_QUERY:
        return 'Invalid request. Please contact support if this persists.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      rateLimit: this.rateLimit,
      stack: this.stack,
    };
  }
}

/**
 * Parse a GraphQL client error and create a structured GraphQLError
 *
 * @param error - The error from graphql-request or other source
 * @returns A structured GraphQLError instance
 */
export function parseGraphQLError(error: any): GraphQLError {
  // Extract error details
  const statusCode = error.response?.status || error.status;
  const errors = error.response?.errors || [];
  const headers = error.response?.headers || {};

  // Determine error code based on status and error messages
  let code = GraphQLErrorCode.UNKNOWN;
  let message = error.message || 'Unknown GraphQL error';

  // Check for rate limit errors
  if (statusCode === 403 || statusCode === 429) {
    code = GraphQLErrorCode.RATE_LIMITED;
    message = 'GitHub API rate limit exceeded';
  }
  // Check for authentication errors
  else if (statusCode === 401) {
    code = GraphQLErrorCode.AUTHENTICATION_FAILED;
    message = 'GitHub authentication failed';
  }
  // Check for not found errors
  else if (statusCode === 404) {
    code = GraphQLErrorCode.NOT_FOUND;
    message = 'Resource not found';
  }
  // Check GraphQL error messages for specific patterns
  else if (errors.length > 0) {
    const errorMessage = errors[0].message?.toLowerCase() || '';

    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      code = GraphQLErrorCode.RATE_LIMITED;
      message = errors[0].message;
    } else if (errorMessage.includes('node limit') || errorMessage.includes('too many nodes')) {
      code = GraphQLErrorCode.NODE_LIMIT_EXCEEDED;
      message = errors[0].message;
    } else if (errorMessage.includes('authentication') || errorMessage.includes('token')) {
      code = GraphQLErrorCode.AUTHENTICATION_FAILED;
      message = errors[0].message;
    } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
      code = GraphQLErrorCode.NOT_FOUND;
      message = errors[0].message;
    } else if (errorMessage.includes('syntax') || errorMessage.includes('parse')) {
      code = GraphQLErrorCode.MALFORMED_QUERY;
      message = errors[0].message;
    } else {
      message = errors[0].message;
    }
  }
  // Check for network errors
  else if (error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT' ||
           error.code === 'ENOTFOUND' ||
           error.name === 'FetchError') {
    code = GraphQLErrorCode.NETWORK_ERROR;
    message = 'Network connection failed';
  }

  // Extract rate limit information if available
  let rateLimit: GraphQLError['rateLimit'];
  if (headers['x-ratelimit-remaining'] !== undefined) {
    rateLimit = {
      remaining: parseInt(headers['x-ratelimit-remaining'], 10) || 0,
      reset: headers['x-ratelimit-reset'] || '',
      limit: parseInt(headers['x-ratelimit-limit'], 10) || 5000,
    };
  }

  return new GraphQLError(message, code, {
    statusCode,
    originalError: error,
    context: {
      errors,
      url: error.response?.url,
    },
    rateLimit,
  });
}