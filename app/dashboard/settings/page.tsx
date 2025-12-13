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
      toast.success(
        "Settings saved! Reports will be generated at your local midnight.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings",
      );
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
        <p className="text-red-600">
          User record not found. Please contact support.
        </p>
      </div>
    );
  }

  const isGitHubConnected = !!convexUser.githubAccessToken;

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-24">
      {/* Back to Reports Link */}
      <Link
        href="/dashboard/reports"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted hover:text-foreground transition-colors"
      >
        ← Index
      </Link>

      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted">
          Configure connections and automated dispatch schedules.
        </p>
      </div>

      {/* GitHub Connection Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
            Connection
          </h2>
          {isGitHubConnected && (
            <span className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
        </div>

        <div className="bg-surface border border-border p-6">
          {isGitHubConnected ? (
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  @{convexUser.githubUsername}
                </p>
                <p className="text-xs text-muted">
                  Syncing repositories automatically.
                </p>
              </div>
              <button
                onClick={handleConnectGitHub}
                className="text-xs font-medium text-foreground border border-border px-4 py-2 hover:bg-surface-muted transition-colors"
              >
                Reconnect
              </button>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <p className="text-sm text-muted max-w-sm mx-auto">
                Connect your GitHub account to enable automated intelligence
                gathering.
              </p>
              <button
                onClick={handleConnectGitHub}
                className="inline-flex items-center gap-2 bg-foreground text-background px-6 py-2.5 text-sm font-medium transition-transform hover:scale-105"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Connect GitHub
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Report Schedule Section */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          Schedule
        </h2>

        <div className="bg-surface border border-border p-6 space-y-8">
          {/* Timezone Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-mono text-muted uppercase tracking-widest">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full bg-surface-muted border-b border-foreground/20 py-2 text-sm font-medium focus:outline-none focus:border-foreground transition-colors"
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
            <p className="text-[10px] text-muted pt-1">
              Reports generated at midnight local time.
            </p>
          </div>

          {/* Toggles */}
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Daily Briefing
                </p>
                <p className="text-xs text-muted">24-hour activity digest.</p>
              </div>
              <button
                onClick={() => setDailyEnabled(!dailyEnabled)}
                className={`relative inline-flex h-6 w-11 items-center border transition-colors ${
                  dailyEnabled
                    ? "bg-foreground border-foreground"
                    : "bg-transparent border-border"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform bg-background transition-transform ${
                    dailyEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Weekly Retrospective
                </p>
                <p className="text-xs text-muted">7-day summary (Mondays).</p>
              </div>
              <button
                onClick={() => setWeeklyEnabled(!weeklyEnabled)}
                className={`relative inline-flex h-6 w-11 items-center border transition-colors ${
                  weeklyEnabled
                    ? "bg-foreground border-foreground"
                    : "bg-transparent border-border"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform bg-background transition-transform ${
                    weeklyEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-foreground text-background px-8 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {/* Repository Link */}
      <section>
        <Link
          href="/dashboard/settings/repositories"
          className="flex items-center justify-between border border-border p-6 hover:bg-surface-muted/50 transition-colors group"
        >
          <div>
            <h2 className="text-sm font-medium text-foreground">
              Manage Sources
            </h2>
            <p className="text-xs text-muted mt-1">
              Configure repositories and organizations.
            </p>
          </div>
          <span className="text-muted group-hover:text-foreground transition-colors">
            →
          </span>
        </Link>
      </section>
    </div>
  );
}
