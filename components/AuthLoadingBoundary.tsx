"use client";

import { ReactNode, Component, ErrorInfo } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * AuthLoadingBoundary - Handles auth loading states with error recovery
 *
 * This boundary ensures that children only render when auth is fully initialized,
 * preventing race conditions where queries fire before authentication is ready.
 *
 * Features:
 * - Loading state while auth initializes
 * - Error boundary for auth-related failures
 * - Retry mechanism for transient errors
 * - Graceful fallback UI
 *
 * Usage:
 * ```tsx
 * <AuthLoadingBoundary fallback={<Spinner />}>
 *   <YourComponent />
 * </AuthLoadingBoundary>
 * ```
 */

interface AuthLoadingBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: (error: Error, retry: () => void) => ReactNode;
}

/**
 * Hook wrapper component for auth state
 */
function AuthLoadingCheck({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  // Auth is still initializing - show loading state
  if (!isLoaded) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Auth loaded - render children (whether signed in or not)
  // The auth provider will handle the actual auth state
  return <>{children}</>;
}

/**
 * Error boundary wrapper for catching auth-related errors
 */
class AuthErrorBoundary extends Component<
  {
    children: ReactNode;
    errorFallback?: (error: Error, retry: () => void) => ReactNode;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    console.error("AuthLoadingBoundary caught error:", error, errorInfo);

    // Log with error code for tracking
    const errorCode = this.getErrorCode(error);
    console.error(`[AUTH_ERROR_${errorCode}]`, error.message);
  }

  getErrorCode(error: Error): string {
    if (error.message.includes("Not authenticated")) return "NOT_AUTH";
    if (error.message.includes("Unauthorized")) return "UNAUTHORIZED";
    if (error.message.includes("network")) return "NETWORK";
    if (error.message.includes("timeout")) return "TIMEOUT";
    return "UNKNOWN";
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.errorFallback) {
        return this.props.errorFallback(this.state.error, this.retry);
      }

      // Default error UI
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-red-600 text-xl">⚠️</div>
            <div className="flex-1">
              <h3 className="font-medium text-red-900">Authentication Error</h3>
              <p className="text-sm text-red-700 mt-1">
                {this.state.error.message}
              </p>
              <button
                onClick={this.retry}
                className="mt-3 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Combined boundary - handles both loading and errors
 */
export function AuthLoadingBoundary({
  children,
  fallback,
  errorFallback,
}: AuthLoadingBoundaryProps) {
  return (
    <AuthErrorBoundary errorFallback={errorFallback}>
      <AuthLoadingCheck fallback={fallback}>{children}</AuthLoadingCheck>
    </AuthErrorBoundary>
  );
}

/**
 * Specialized boundary for components that should hide when not authenticated
 * instead of showing loading state
 */
export function AuthRequiredBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null; // Don't show anything while loading
  }

  if (!isSignedIn) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
