"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import Link from "next/link";
import { useAuthenticatedConvexUser } from "@/hooks/useAuthenticatedConvexUser";

export default function SettingsPage() {
  const { clerkUser, convexUser, isLoading } = useAuthenticatedConvexUser();

  const [timezone, setTimezone] = useState("");
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [weeklyEnabled, setWeeklyEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const updateSettings = useMutation(api.users.updateSettings);

  // Initialize form with current user settings
  // setState in render is safe here: first render has timezone="", second render condition is false
  if (convexUser && !timezone) {
    setTimezone(convexUser.timezone || "America/Los_Angeles");
    setDailyEnabled(convexUser.dailyReportsEnabled ?? true);
    setWeeklyEnabled(convexUser.weeklyReportsEnabled ?? true);
  }

  const handleSave = async () => {
    if (!clerkUser?.id) {
      toast.error("You must be signed in to save settings");
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings({
        clerkId: clerkUser.id,
        timezone,
        dailyReportsEnabled: dailyEnabled,
        weeklyReportsEnabled: weeklyEnabled,
      });
      toast.success("Settings saved! Reports will be generated at your local 9am.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectGitHub = () => {
    // Redirect to OAuth initiation
    window.location.href = "/api/auth/github";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Should never happen: loading is false but convexUser is undefined
  // This means user is authenticated but doesn't have a Convex record
  if (!convexUser) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-600">User record not found. Please contact support.</p>
      </div>
    );
  }

  const isGitHubConnected = !!convexUser.githubAccessToken;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back to Reports Link */}
      <Link
        href="/dashboard/reports"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Reports
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Configure your GitHub connection and report schedule
        </p>
      </div>

      {/* GitHub Connection Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          GitHub Connection
        </h2>

        {isGitHubConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-600 rounded-full" />
              <span className="text-sm font-medium text-gray-900">
                Connected as @{convexUser.githubUsername}
              </span>
            </div>

            <p className="text-sm text-gray-600">
              GitPulse can now automatically discover and sync all your GitHub repositories.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleConnectGitHub}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Reconnect GitHub
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Connect your GitHub account to enable automated daily standups and weekly retros.
              We&apos;ll automatically discover all repositories you have access to.
            </p>

            <button
              onClick={handleConnectGitHub}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Connect GitHub Account
            </button>
          </div>
        )}
      </div>

      {/* Report Schedule Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Report Schedule
        </h2>

        <div className="space-y-6">
          {/* Timezone Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Europe/Paris">Central European Time</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Asia/Shanghai">Shanghai (CST)</option>
              <option value="Australia/Sydney">Sydney (AEST)</option>
              <option value="UTC">UTC</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Reports will be generated at 9:00 AM in your local timezone
            </p>
          </div>

          {/* Daily Reports Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Daily Standups</p>
              <p className="text-xs text-gray-500">
                Automated report of yesterday&apos;s activity, every morning at 9am
              </p>
            </div>
            <button
              onClick={() => setDailyEnabled(!dailyEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                dailyEnabled ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dailyEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Weekly Reports Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Weekly Retros</p>
              <p className="text-xs text-gray-500">
                Automated report of last week&apos;s activity, every Monday at 9am
              </p>
            </div>
            <button
              onClick={() => setWeeklyEnabled(!weeklyEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                weeklyEnabled ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  weeklyEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Repository Management Section */}
      <Link
        href="/dashboard/settings/repositories"
        className="block bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Manage Repositories
            </h2>
            <p className="text-sm text-gray-600">
              Add or remove GitHub repositories for activity tracking and reports
            </p>
          </div>
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Link>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <div className="text-blue-600 text-xl">ℹ️</div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-900 mb-1">
              How Automated Reports Work
            </h3>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Daily standups cover activity from the previous 24 hours</li>
              <li>• Weekly retros cover activity from the previous 7 days</li>
              <li>• Reports include all GitHub activity across your connected repositories</li>
              <li>• AI-generated summaries with citations to PRs, commits, and reviews</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
