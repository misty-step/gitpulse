/**
 * Error tracking abstraction layer
 *
 * Provides a unified interface for error tracking services like Sentry,
 * with graceful fallback when no service is configured.
 */

import { logger } from './logger';

const MODULE_NAME = 'errorTracking';

/**
 * Error severity levels matching common error tracking services
 */
export enum ErrorSeverity {
  /** Debugging information */
  DEBUG = 'debug',
  /** Informational message */
  INFO = 'info',
  /** Warning that doesn't prevent operation */
  WARNING = 'warning',
  /** Error that prevents specific operation */
  ERROR = 'error',
  /** Critical error that may affect system stability */
  FATAL = 'fatal',
}

/**
 * Error context for additional debugging information
 */
export interface ErrorContext {
  /** Additional tags for categorization */
  tags?: Record<string, string>;
  /** Extra data to attach to the error */
  extra?: Record<string, any>;
  /** User information (if available) */
  user?: {
    id?: string;
    username?: string;
    email?: string;
  };
  /** Request information */
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
}

/**
 * Error tracking service interface
 */
export interface ErrorTrackingService {
  /**
   * Capture an exception
   */
  captureException(error: Error, context?: ErrorContext): void;

  /**
   * Capture a message
   */
  captureMessage(message: string, severity?: ErrorSeverity, context?: ErrorContext): void;

  /**
   * Add breadcrumb for debugging trail
   */
  addBreadcrumb(message: string, data?: Record<string, any>): void;

  /**
   * Set user context for errors
   */
  setUser(user: { id?: string; username?: string; email?: string } | null): void;

  /**
   * Set tags that will be attached to all subsequent events
   */
  setTags(tags: Record<string, string>): void;

  /**
   * Set extra data that will be attached to all subsequent events
   */
  setExtras(extras: Record<string, any>): void;
}

/**
 * Fallback error tracking implementation that logs to console
 */
class ConsoleErrorTracking implements ErrorTrackingService {
  captureException(error: Error, context?: ErrorContext): void {
    logger.error(MODULE_NAME, 'Exception captured', {
      error: error.message,
      stack: error.stack,
      context,
    });
  }

  captureMessage(message: string, severity: ErrorSeverity = ErrorSeverity.INFO, context?: ErrorContext): void {
    logger.info(MODULE_NAME, `Message captured [${severity}]: ${message}`, context);
  }

  addBreadcrumb(message: string, data?: Record<string, any>): void {
    logger.debug(MODULE_NAME, `Breadcrumb: ${message}`, data);
  }

  setUser(user: { id?: string; username?: string; email?: string } | null): void {
    logger.debug(MODULE_NAME, 'User context set', { user });
  }

  setTags(tags: Record<string, string>): void {
    logger.debug(MODULE_NAME, 'Tags set', { tags });
  }

  setExtras(extras: Record<string, any>): void {
    logger.debug(MODULE_NAME, 'Extras set', { extras });
  }
}

/**
 * Sentry error tracking implementation
 * This is a placeholder for when Sentry is integrated
 */
class SentryErrorTracking implements ErrorTrackingService {
  private isInitialized = false;

  constructor() {
    // Check if Sentry is configured
    const sentryDsn = process.env.SENTRY_DSN;
    if (sentryDsn) {
      this.isInitialized = true;
      logger.info(MODULE_NAME, 'Sentry error tracking initialized');
      // TODO: Initialize Sentry SDK when package is added
      // Sentry.init({ dsn: sentryDsn, environment: process.env.NODE_ENV });
    } else {
      logger.debug(MODULE_NAME, 'Sentry DSN not configured, using console fallback');
    }
  }

  captureException(error: Error, context?: ErrorContext): void {
    if (!this.isInitialized) {
      new ConsoleErrorTracking().captureException(error, context);
      return;
    }

    // TODO: Implement Sentry exception capture
    // Sentry.captureException(error, {
    //   tags: context?.tags,
    //   extra: context?.extra,
    //   user: context?.user,
    // });
    logger.error(MODULE_NAME, 'Sentry would capture exception', {
      error: error.message,
      context,
    });
  }

  captureMessage(message: string, severity: ErrorSeverity = ErrorSeverity.INFO, context?: ErrorContext): void {
    if (!this.isInitialized) {
      new ConsoleErrorTracking().captureMessage(message, severity, context);
      return;
    }

    // TODO: Implement Sentry message capture
    // Sentry.captureMessage(message, {
    //   level: severity,
    //   tags: context?.tags,
    //   extra: context?.extra,
    // });
    logger.info(MODULE_NAME, `Sentry would capture message [${severity}]: ${message}`, context);
  }

  addBreadcrumb(message: string, data?: Record<string, any>): void {
    if (!this.isInitialized) {
      new ConsoleErrorTracking().addBreadcrumb(message, data);
      return;
    }

    // TODO: Implement Sentry breadcrumb
    // Sentry.addBreadcrumb({ message, data });
    logger.debug(MODULE_NAME, `Sentry would add breadcrumb: ${message}`, data);
  }

  setUser(user: { id?: string; username?: string; email?: string } | null): void {
    if (!this.isInitialized) {
      new ConsoleErrorTracking().setUser(user);
      return;
    }

    // TODO: Implement Sentry user context
    // Sentry.setUser(user);
    logger.debug(MODULE_NAME, 'Sentry would set user', { user });
  }

  setTags(tags: Record<string, string>): void {
    if (!this.isInitialized) {
      new ConsoleErrorTracking().setTags(tags);
      return;
    }

    // TODO: Implement Sentry tags
    // Sentry.setTags(tags);
    logger.debug(MODULE_NAME, 'Sentry would set tags', { tags });
  }

  setExtras(extras: Record<string, any>): void {
    if (!this.isInitialized) {
      new ConsoleErrorTracking().setExtras(extras);
      return;
    }

    // TODO: Implement Sentry extras
    // Sentry.setContext('extras', extras);
    logger.debug(MODULE_NAME, 'Sentry would set extras', { extras });
  }
}

/**
 * Global error tracking instance
 */
let errorTrackingInstance: ErrorTrackingService | null = null;

/**
 * Initialize error tracking service
 *
 * @param service Optional custom error tracking service
 * @returns The initialized error tracking service
 */
export function initErrorTracking(service?: ErrorTrackingService): ErrorTrackingService {
  if (errorTrackingInstance) {
    logger.warn(MODULE_NAME, 'Error tracking already initialized');
    return errorTrackingInstance;
  }

  if (service) {
    errorTrackingInstance = service;
    logger.info(MODULE_NAME, 'Error tracking initialized with custom service');
  } else {
    // Auto-detect and initialize appropriate service
    const useSentry = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    errorTrackingInstance = useSentry ? new SentryErrorTracking() : new ConsoleErrorTracking();
  }

  return errorTrackingInstance;
}

/**
 * Get the current error tracking instance
 *
 * Initializes with default service if not already initialized
 */
export function getErrorTracking(): ErrorTrackingService {
  if (!errorTrackingInstance) {
    return initErrorTracking();
  }
  return errorTrackingInstance;
}

/**
 * Capture an exception with error tracking
 *
 * @param error The error to capture
 * @param context Optional context information
 */
export function captureException(error: Error, context?: ErrorContext): void {
  getErrorTracking().captureException(error, context);
}

/**
 * Capture a message with error tracking
 *
 * @param message The message to capture
 * @param severity The severity level
 * @param context Optional context information
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity = ErrorSeverity.INFO,
  context?: ErrorContext
): void {
  getErrorTracking().captureMessage(message, severity, context);
}

/**
 * Add a breadcrumb for debugging trail
 *
 * @param message The breadcrumb message
 * @param data Optional data to attach
 */
export function addBreadcrumb(message: string, data?: Record<string, any>): void {
  getErrorTracking().addBreadcrumb(message, data);
}

/**
 * Set user context for error tracking
 *
 * @param user User information or null to clear
 */
export function setUser(user: { id?: string; username?: string; email?: string } | null): void {
  getErrorTracking().setUser(user);
}

/**
 * Set tags for all subsequent error events
 *
 * @param tags Tags to set
 */
export function setTags(tags: Record<string, string>): void {
  getErrorTracking().setTags(tags);
}

/**
 * Set extra data for all subsequent error events
 *
 * @param extras Extra data to set
 */
export function setExtras(extras: Record<string, any>): void {
  getErrorTracking().setExtras(extras);
}