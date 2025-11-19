/**
 * Shared types for Convex actions and queries
 *
 * These types provide consistency across the codebase and improve type safety.
 * All actions should return these standardized types.
 */

import { Id } from "../_generated/dataModel";

/**
 * Ingestion Statistics
 *
 * Returned by ingestion actions to report what was processed
 */
export interface IngestionStats {
  prsIngested: number;
  reviewsIngested: number;
  commitsIngested: number;
  totalEvents: number;
}

/**
 * Single Repository Ingestion Result
 *
 * Returned by ingestRepository action
 */
export interface IngestionResult {
  success: boolean;
  repository: string;
  since: string;
  stats: IngestionStats;
}

/**
 * Multiple Repository Ingestion Result
 *
 * Returned by ingestMultipleRepos action
 */
export interface BatchIngestionResult {
  jobId: Id<"ingestionJobs">;
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    repoFullName: string;
    success: boolean;
    error?: string;
    stats?: IngestionStats;
  }>;
}

/**
 * Repository Metadata from GitHub API
 *
 * Simplified structure for repository discovery
 */
export interface RepoMetadata {
  fullName: string;
  name: string;
  owner: string;
  description?: string;
  language?: string;
  stars: number;
  isPrivate: boolean;
}

/**
 * Error Response
 *
 * Standardized error format for all actions
 */
export interface ActionError {
  code: string;
  message: string;
  details?: any;
  timestamp: number;
}

/**
 * Error Codes
 *
 * Standardized error codes for tracking and debugging
 */
export enum ErrorCode {
  // Auth errors
  NOT_AUTHENTICATED = "NOT_AUTHENTICATED",
  UNAUTHORIZED = "UNAUTHORIZED",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // API errors
  GITHUB_API_ERROR = "GITHUB_API_ERROR",
  RATE_LIMIT = "RATE_LIMIT",
  NOT_FOUND = "NOT_FOUND",

  // Validation errors
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_PARAMETER = "MISSING_PARAMETER",

  // System errors
  DATABASE_ERROR = "DATABASE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  UNKNOWN = "UNKNOWN",
}

/**
 * Create standardized error
 */
export function createError(
  code: ErrorCode,
  message: string,
  details?: any
): ActionError {
  return {
    code,
    message,
    details,
    timestamp: Date.now(),
  };
}

/**
 * Success wrapper for actions
 *
 * Ensures consistent response format
 */
export interface ActionSuccess<T> {
  success: true;
  data: T;
  timestamp: number;
}

/**
 * Error wrapper for actions
 *
 * Ensures consistent error format
 */
export interface ActionFailure {
  success: false;
  error: ActionError;
}

/**
 * Generic action result
 *
 * All actions should return this type
 */
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

/**
 * Helper to create success result
 */
export function success<T>(data: T): ActionSuccess<T> {
  return {
    success: true,
    data,
    timestamp: Date.now(),
  };
}

/**
 * Helper to create error result
 */
export function failure(error: ActionError): ActionFailure {
  return {
    success: false,
    error,
  };
}

/**
 * Installation Role
 *
 * Role of a user in a GitHub App installation
 */
export type InstallationRole = "owner" | "viewer";

/**
 * User Installation Claim
 *
 * Represents a user's claim to a GitHub App installation
 */
export interface UserInstallation {
  userId: string;
  installationId: number;
  role: InstallationRole;
  claimedAt: number;
  // Hydrated fields for UI
  accountLogin?: string;
  repoCount?: number;
  lastSyncedAt?: number;
}

/**
 * Tracked Repository Configuration
 *
 * User preference for tracking a specific repository
 */
export interface TrackedRepo {
  userId: string;
  installationId: number;
  repoFullName: string;
  tracked: boolean;
}
