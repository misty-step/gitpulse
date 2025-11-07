/**
 * Error handling utilities for Convex mutations and actions
 *
 * Deep module: Simple toast interface hiding error classification complexity
 */

import { toast } from "sonner";

/**
 * Convex error patterns and their user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  "Not authenticated": "Please sign in to continue",
  "Unauthorized": "You don't have permission to perform this action",
  "Invalid token": "Your session has expired. Please sign in again",

  // Validation errors
  "Invalid input": "Please check your input and try again",
  "Missing required": "Please fill in all required fields",
  "Invalid format": "Please check the format of your input",

  // Rate limiting
  "Rate limit": "Too many requests. Please wait a moment and try again",
  "Quota exceeded": "You've reached your usage limit. Please upgrade your plan",

  // Resource errors
  "Not found": "The requested resource was not found",
  "Already exists": "This resource already exists",
  "Conflict": "This operation conflicts with existing data",

  // External service errors
  "GitHub API": "Unable to connect to GitHub. Please try again later",
  "Voyage API": "Embedding service unavailable. Please try again later",
  "Google API": "AI service unavailable. Please try again later",
  "OpenAI API": "AI service unavailable. Please try again later",

  // Database errors
  "Database": "A database error occurred. Please try again",
  "Transaction": "The operation could not be completed. Please try again",

  // Generic fallback
  default: "An unexpected error occurred. Please try again",
};

/**
 * Classify error type for appropriate handling
 */
export type ErrorType = "transient" | "permanent" | "validation" | "auth";

export function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();

  // Transient errors (can retry)
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("unavailable") ||
    message.includes("api") ||
    message.includes("service")
  ) {
    return "transient";
  }

  // Authentication errors
  if (
    message.includes("not authenticated") ||
    message.includes("unauthorized") ||
    message.includes("token") ||
    message.includes("permission")
  ) {
    return "auth";
  }

  // Validation errors
  if (
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("format") ||
    message.includes("validation")
  ) {
    return "validation";
  }

  // Default to permanent (don't retry)
  return "permanent";
}

/**
 * Get user-friendly error message from error object
 */
export function getErrorMessage(error: Error): string {
  const message = error.message;

  // Check for exact matches first
  for (const [pattern, friendlyMessage] of Object.entries(ERROR_MESSAGES)) {
    if (pattern === "default") continue;
    if (message.includes(pattern)) {
      return friendlyMessage;
    }
  }

  // Fallback to default message
  return ERROR_MESSAGES.default;
}

/**
 * Handle Convex mutation/action errors with toast notifications
 *
 * @param error - The error from Convex
 * @param options - Configuration for error handling
 * @returns Error type classification
 */
export function handleConvexError(
  error: Error,
  options: {
    operation?: string; // e.g., "add repository", "generate report"
    retry?: () => void; // Callback to retry the operation
    onAuthError?: () => void; // Redirect to sign-in
  } = {}
): ErrorType {
  const errorType = classifyError(error);
  const message = getErrorMessage(error);

  // Log error for debugging
  console.error(`[Convex Error] ${options.operation || "Operation"}:`, error);

  // Show appropriate toast based on error type
  switch (errorType) {
    case "transient":
      toast.error(message, {
        description: options.retry
          ? "You can try again"
          : "This might be temporary",
        action: options.retry
          ? {
              label: "Retry",
              onClick: options.retry,
            }
          : undefined,
      });
      break;

    case "auth":
      toast.error(message, {
        description: "Please check your authentication status",
        action: options.onAuthError
          ? {
              label: "Sign In",
              onClick: options.onAuthError,
            }
          : undefined,
      });
      if (options.onAuthError) {
        setTimeout(options.onAuthError, 2000);
      }
      break;

    case "validation":
      toast.error(message, {
        description: "Please check your input and try again",
      });
      break;

    case "permanent":
      toast.error(message, {
        description: options.operation
          ? `Failed to ${options.operation}`
          : undefined,
      });
      break;
  }

  return errorType;
}

/**
 * Show success toast for completed operations
 */
export function showSuccess(
  message: string,
  description?: string
): void {
  toast.success(message, { description });
}

/**
 * Show loading toast for long-running operations
 *
 * @returns Promise ID that can be used to dismiss the toast
 */
export function showLoading(message: string): string | number {
  return toast.loading(message);
}

/**
 * Dismiss a loading toast and show result
 */
export function dismissLoading(
  toastId: string | number,
  result: { success: boolean; message: string; description?: string }
): void {
  toast.dismiss(toastId);
  if (result.success) {
    toast.success(result.message, { description: result.description });
  } else {
    toast.error(result.message, { description: result.description });
  }
}

/**
 * Wrapper for async operations with automatic error handling
 *
 * @example
 * ```typescript
 * const result = await withErrorHandling(
 *   () => ingestRepo({ repoFullName, sinceISO }),
 *   { operation: "add repository" }
 * );
 * if (result.success) {
 *   // Handle success
 * }
 * ```
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  options: {
    operation?: string;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    retry?: () => void;
    showLoading?: boolean;
  } = {}
): Promise<{ success: boolean; data?: T; error?: Error }> {
  const loadingId = options.showLoading
    ? toast.loading(options.operation || "Processing...")
    : undefined;

  try {
    const data = await fn();

    if (loadingId !== undefined) {
      toast.dismiss(loadingId);
    }

    if (options.onSuccess) {
      options.onSuccess(data);
    }

    return { success: true, data };
  } catch (error) {
    if (loadingId !== undefined) {
      toast.dismiss(loadingId);
    }

    const err = error instanceof Error ? error : new Error(String(error));

    handleConvexError(err, {
      operation: options.operation,
      retry: options.retry,
    });

    if (options.onError) {
      options.onError(err);
    }

    return { success: false, error: err };
  }
}
