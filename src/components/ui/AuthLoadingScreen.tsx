'use client';

import React from 'react';
import AuthLoadingCard from './AuthLoadingCard'; // Import the composed component
import './AuthLoadingScreen.css'; // Import the CSS file for default variables

/**
 * Props for the AuthLoadingScreen component.
 * Theming is now primarily controlled via CSS custom properties.
 */
interface AuthLoadingScreenProps {
  /**
   * Primary message displayed as a title within the card.
   * @default 'Verifying Authentication'
   */
  message?: string;

  /**
   * Secondary message displayed below the status line within the card.
   * @default 'Please wait while we verify your credentials'
   */
  subMessage?: string;

  /**
   * Status line message displayed with animation (if motion is enabled).
   * @default 'System access verification in progress...'
   */
  statusMessage?: string;

  /**
   * Optional footer message displayed at the bottom of the card.
   * @default 'SECURE CONNECTION ESTABLISHED'
   */
  footerMessage?: string;

  /**
   * Optional CSS class name to apply to the container element.
   * Use this or parent styles to override CSS custom properties for theming.
   */
  className?: string;
}

/**
 * A stylized full-screen loading indicator typically used during authentication flows.
 *
 * Features a terminal-inspired aesthetic with configurable messages. Theming (colors,
 * backgrounds, effects) is controlled via CSS custom properties defined in
 * `AuthLoadingScreen.css` or overridden by parent styles.
 *
 * Animations and effects like backdrop blur respect the user's `prefers-reduced-motion`
 * setting automatically via Tailwind's `motion-safe`/`motion-reduce` variants.
 *
 * @example Basic Usage
 * ```tsx
 * <AuthLoadingScreen />
 * ```
 *
 * @example Custom Messages
 * ```tsx
 * <AuthLoadingScreen
 *   message="Initializing Secure Session"
 *   subMessage="Establishing encrypted connection..."
 *   statusMessage="Contacting authorization server..."
 * />
 * ```
 *
 * @example Custom Theme (via CSS override)
 * ```css
 * // In a global CSS file or parent component's style
 * .custom-auth-loading {
 *   --auth-primary-color: #ff00ff;
 *   --auth-card-bg: rgba(50, 0, 50, 0.6);
 * }
 * ```
 * ```tsx
 * <div className="custom-auth-loading">
 *   <AuthLoadingScreen />
 * </div>
 * // Or using inline style (less recommended for full themes)
 * <div style={{ '--auth-primary-color': '#ff00ff' } as React.CSSProperties}>
 *    <AuthLoadingScreen />
 * </div>
 * ```
 */
export default function AuthLoadingScreen({
  message = 'Verifying Authentication',
  subMessage = 'Please wait while we verify your credentials',
  statusMessage = 'System access verification in progress...',
  footerMessage = 'SECURE CONNECTION ESTABLISHED',
  className = '',
}: AuthLoadingScreenProps) {
  return (
    <div
      // Apply base class for scoping CSS variables and base styles
      className={`auth-loading-screen min-h-screen flex flex-col items-center justify-center p-1.5 ${className}`}
      // Accessibility attributes indicating busy state
      role="alert"
      aria-live="assertive" // Announce changes immediately
      aria-busy="true"      // Indicate the component is busy
      aria-label={message}  // Provide context for the alert
    >
      <AuthLoadingCard
        message={message}
        subMessage={subMessage}
        statusMessage={statusMessage}
        footerMessage={footerMessage}
      />
    </div>
  );
}