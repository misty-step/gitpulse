'use client';

import React from 'react';
import StatusDisplay from './StatusDisplay'; // Import the new component

/**
 * Props for the AuthLoadingCard component
 * @internal
 */
interface AuthLoadingCardProps {
  /** Primary message title */
  message: string;
  /** Status line message for StatusDisplay */
  statusMessage: string;
  /** Secondary message for StatusDisplay */
  subMessage: string;
  /** Optional footer message */
  footerMessage?: string;
}

/**
 * The central card element for the AuthLoadingScreen, featuring a terminal-like interface.
 * Relies on CSS variables for colors, background, and effects.
 * Uses Tailwind's motion variants to control backdrop blur.
 * @internal
 */
export default function AuthLoadingCard({
  message,
  statusMessage,
  subMessage,
  footerMessage,
}: AuthLoadingCardProps) {
  return (
    <div
      // Apply backdrop filter and disable it if motion is reduced using Tailwind variants
      className="w-full max-w-md p-3 space-y-8 border-2 rounded-md motion-safe:backdrop-blur-md"
      style={{
        // Use CSS variables for styling
        backgroundColor: 'var(--auth-card-bg)',
        boxShadow: `0 0 20px rgba(var(--auth-primary-color), var(--auth-shadow-opacity))`,
        borderColor: 'var(--auth-primary-color)',
      }}
    >
      {/* Terminal-style header */}
      <div className="flex items-center mb-4">
        <div className="flex space-x-1 mr-3">
          {/* Use CSS variables for dot colors */}
          {[
            'var(--auth-primary-color)',
            'var(--auth-secondary-color)',
            'var(--auth-text-color)',
          ].map((color, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
              aria-hidden="true" // Decorative dots
            />
          ))}
        </div>
        <div
          className="h-px flex-grow"
          style={{ backgroundColor: 'var(--auth-secondary-color)' }}
          aria-hidden="true" // Decorative line
        ></div>
      </div>

      {/* Main Message */}
      <h2
        className="text-xl text-center font-semibold" // Added font-semibold for emphasis
        style={{ color: 'var(--auth-primary-color)' }}
      >
        {message}
      </h2>

      {/* Status Display (composed component) */}
      <StatusDisplay statusMessage={statusMessage} subMessage={subMessage} />

      {/* Footer */}
      {footerMessage && (
        <div
          className="text-center text-xs pt-4" // Added padding-top
          style={{ color: 'var(--auth-text-color)' }}
        >
          <p>{footerMessage}</p>
          <div className="flex justify-center items-center mt-2" aria-hidden="true">
            <div className="h-px w-8" style={{ backgroundColor: 'var(--auth-secondary-color)' }}></div>
            <div className="px-2">•</div>
            <div className="h-px w-8" style={{ backgroundColor: 'var(--auth-secondary-color)' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}