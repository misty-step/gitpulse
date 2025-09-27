'use client';

import React from 'react';

/**
 * Props for the StatusDisplay component
 * @internal
 */
interface StatusDisplayProps {
  /** Status line message */
  statusMessage: string;
  /** Secondary message */
  subMessage: string;
}

/**
 * Displays the animated status messages and spinner within the AuthLoadingCard.
 * Relies on CSS variables (--auth-secondary-color, --auth-text-color) for theming.
 * Uses Tailwind's motion variants for animation control.
 * @internal
 */
export default function StatusDisplay({ statusMessage, subMessage }: StatusDisplayProps) {
  return (
    <div
      className="flex items-start space-x-4 p-1.5 border border-opacity-30 rounded-md"
      style={{
        // Use CSS variables for styling
        borderColor: 'var(--auth-secondary-color)',
        backgroundColor: 'rgba(249, 250, 251, 0.8)',
      }}
    >
      {/* Spinner */}
      <div style={{ color: 'var(--auth-secondary-color)' }}>
        <svg
          // Apply animation conditionally using Tailwind variant
          className="h-8 w-8 motion-safe:animate-spin" // Use Tailwind's animate-spin
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true" // Hide decorative SVG from screen readers
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span className="sr-only">Loading...</span> {/* Accessible text for spinner */}
      </div>

      {/* Messages */}
      <div className="space-y-2 flex-1">
        <p
          // Apply animation conditionally using Tailwind variant
          className="text-sm motion-safe:animate-pulse" // Use Tailwind's animate-pulse
          style={{ color: 'var(--auth-secondary-color)' }}
        >
          &gt; {statusMessage}
        </p>
        <p className="text-xs" style={{ color: 'var(--auth-text-color)' }}>
          &gt; {subMessage}
        </p>
        {/* Cursor animation */}
        <div
          className="flex space-x-1 text-xs mt-2"
          style={{ color: 'var(--auth-text-color)' }}
        >
          <span>&gt;</span>
          {/* Apply animation conditionally using Tailwind variant */}
          <span className="motion-safe:animate-pulse">|</span>
        </div>
      </div>
    </div>
  );
}