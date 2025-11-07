"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

/**
 * AuthStatusIndicator - Shows current authentication status
 *
 * Displays:
 * - Green indicator when authenticated
 * - Red indicator when not authenticated
 * - User info on hover (in 'default' variant)
 * - Link to setup guide if auth broken
 *
 * Usage: Place in dashboard layout header
 *
 * @param variant - 'default' (with dropdown details) or 'inline' (simple text only)
 */
export function AuthStatusIndicator({ variant = "default" }: { variant?: "default" | "inline" }) {
  const authHealth = useQuery(api.lib.authHealth.check);
  const [showDetails, setShowDetails] = useState(false);

  if (!authHealth) {
    if (variant === "inline") {
      return (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          Checking auth...
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-lg">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
        <span className="text-xs text-gray-600">Checking auth...</span>
      </div>
    );
  }

  const isAuth = authHealth.isAuthenticated;

  // Inline variant: simple text-only status
  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <div
          className={`w-2 h-2 rounded-full ${
            isAuth ? "bg-green-600" : "bg-red-600"
          }`}
        />
        <span
          className={`font-medium ${
            isAuth ? "text-green-900" : "text-red-900"
          }`}
        >
          {isAuth ? "GitHub Connected" : "GitHub Disconnected"}
        </span>
      </div>
    );
  }

  // Default variant: interactive with dropdown details
  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1 rounded-lg transition-colors ${
          isAuth
            ? "bg-green-50 hover:bg-green-100"
            : "bg-red-50 hover:bg-red-100"
        }`}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            isAuth ? "bg-green-600" : "bg-red-600"
          }`}
        />
        <span
          className={`text-xs font-medium ${
            isAuth ? "text-green-900" : "text-red-900"
          }`}
        >
          {isAuth ? "Authenticated" : "Not Authenticated"}
        </span>
      </button>

      {showDetails && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Auth Status
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  isAuth
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isAuth ? "✓ Working" : "✗ Broken"}
              </span>
            </div>

            {isAuth ? (
              <>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-gray-500">User ID:</span>
                    <span className="ml-2 text-gray-900 font-mono">
                      {authHealth.userId}
                    </span>
                  </div>
                  {authHealth.email && (
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 text-gray-900">
                        {authHealth.email}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Issuer:</span>
                    <span className="ml-2 text-gray-900 font-mono text-[10px]">
                      {authHealth.issuer}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    ✓ {authHealth.message}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
                  <p className="font-medium mb-1">⚠️ {authHealth.message}</p>
                  <p className="text-[11px] text-red-600">
                    {authHealth.setupGuide}
                  </p>
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <a
                    href="/CLERK_JWT_SETUP.md"
                    target="_blank"
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    → View Setup Guide
                  </a>
                </div>
              </>
            )}

            <div className="pt-2 border-t border-gray-200 text-[10px] text-gray-400">
              Last checked: {new Date(authHealth.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
