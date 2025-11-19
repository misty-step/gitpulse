"use client";

import { useState } from "react";
import { useAction, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { handleConvexError, showSuccess } from "@/lib/errors";
import Link from "next/link";
import { IntegrationStatusBanner } from "@/components/IntegrationStatusBanner";
import { AuthLoadingBoundary } from "@/components/AuthLoadingBoundary";
import { SkeletonRepoList } from "@/components/Skeleton";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { formatTimestamp, getGithubInstallUrl } from "@/lib/integrationStatus";
import type { IntegrationStatus } from "@/lib/integrationStatus";

export default function RepositoriesPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const { status: integrationStatus } = useIntegrationStatus();

  // Use paginated query - Convex handles paginationOpts automatically
  const { results: repos, status, loadMore } = usePaginatedQuery(
    api.repos.list,
    {},
    { initialNumItems: 50 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Repositories</h1>
          <p className="mt-2 text-gray-600">
            Manage GitHub repositories for analysis
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Add Repository
        </button>
      </div>

      {/* Add Repository Form */}
      {showAddForm && (
        <AddRepositoryForm onClose={() => setShowAddForm(false)} />
      )}

      {/* Integration Health */}
      {integrationStatus ? <IntegrationHealthCard status={integrationStatus} /> : null}

      {/* Progress Banner for Active Ingestions */}
      <AuthLoadingBoundary>
        <IntegrationStatusBanner />
      </AuthLoadingBoundary>

      {/* Repositories Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {status === "LoadingFirstPage" ? (
          <SkeletonRepoList repos={5} />
        ) : repos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No repositories yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first repository
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Repository
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {repos.map((repo) => (
                <tr key={repo._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/settings/repositories/${repo._id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        {repo.name}
                      </Link>
                      {repo.isPrivate && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {repo.description}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {repo.owner}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {repo.language || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(repo.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-3">
                    <Link
                      href={`/dashboard/settings/repositories/${repo._id}`}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View Details
                    </Link>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-gray-700 font-medium"
                    >
                      GitHub →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Load More Button */}
        {status !== "LoadingFirstPage" && repos.length > 0 && status !== "Exhausted" && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => loadMore(50)}
              disabled={status === "LoadingMore"}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === "LoadingMore" ? "Loading..." : `Load More Repositories (${repos.length} loaded)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddRepositoryForm({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [repoFullName, setRepoFullName] = useState("");
  const [username, setUsername] = useState("");
  const [scopeType, setScopeType] = useState<"user" | "org">("user");
  const [sinceDate, setSinceDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90); // Default: 90 days ago
    return date.toISOString().split("T")[0];
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  const ingestRepo = useAction(api.actions.ingestRepo.ingestRepository);
  const ingestMultiple = useAction(api.actions.ingestMultiple.ingestMultipleRepos);
  const listRepos = useAction(api.actions.listRepos.listReposForScope);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    setResultMessage("");

    try {
      const sinceISO = new Date(sinceDate).toISOString();

      if (mode === "single") {
        // Single repo mode
        if (!repoFullName.includes("/")) {
          setError('Repository format must be "owner/repo"');
          setIsSubmitting(false);
          return;
        }

        await ingestRepo({
          repoFullName,
          sinceISO,
        });

        showSuccess(
          "Repository added successfully",
          `Ingesting ${repoFullName}. This may take a few moments.`
        );
      } else {
        // Batch mode: user or org
        if (!username.trim()) {
          setError(`Please enter a ${scopeType === "user" ? "username" : "organization name"}`);
          setIsSubmitting(false);
          return;
        }

        // List repos via Convex action (server-side GitHub API call)
        setResultMessage(`Discovering repositories for ${username}...`);
        const repos = await listRepos({
          scopeType,
          identifier: username,
        });

        if (repos.length === 0) {
          setError(`No repositories found for ${scopeType} "${username}"`);
          setIsSubmitting(false);
          return;
        }

        const repoFullNames = repos.map(r => r.fullName);

        // Call batch ingestion with metadata for progress tracking
        setResultMessage(`Starting batch ingestion for ${repos.length} repositories...`);
        const result = await ingestMultiple({
          repoFullNames,
          sinceISO,
          metadata: {
            username,
            scopeType,
            totalRepos: repos.length,
          },
        });

        // Close modal immediately - progress will show in banner
        onClose();

        // Show toast notification
        showSuccess(
          `Batch ingestion started`,
          `Ingesting ${result.total} repositories for ${username}. Check progress above.`
        );

        return; // Exit early for batch mode - no 2-second wait
      }

      // Single repo mode - show success and auto-close after 2 seconds
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to ingest repository");
      handleConvexError(error, {
        operation: mode === "single" ? "add repository" : "add repositories",
        retry: () => handleSubmit(e),
      });
      setError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add Repository</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mode Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ingestion Mode
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  mode === "single"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Single Repo
              </button>
              <button
                type="button"
                onClick={() => setMode("batch")}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  mode === "batch"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                User/Org Repos
              </button>
            </div>
          </div>

          {/* Single Repo Fields */}
          {mode === "single" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repository Full Name
              </label>
              <input
                type="text"
                value={repoFullName}
                onChange={(e) => setRepoFullName(e.target.value)}
                placeholder="facebook/react"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Format: owner/repository (e.g., facebook/react)
              </p>
            </div>
          )}

          {/* Batch Mode Fields */}
          {mode === "batch" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scope Type
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setScopeType("user")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      scopeType === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    User
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeType("org")}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      scopeType === "org"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Organization
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {scopeType === "user" ? "GitHub Username" : "Organization Name"}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={scopeType === "user" ? "torvalds" : "facebook"}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will add all {scopeType === "user" ? "user's" : "organization's"} public repositories. Private repos require token with appropriate access.
                </p>
              </div>
            </>
          )}

          {/* Since Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ingest Since
            </label>
            <input
              type="date"
              value={sinceDate}
              onChange={(e) => setSinceDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Fetch events from this date onwards
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Result Message (for batch mode progress) */}
          {resultMessage && !success && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-600">
              {resultMessage}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {resultMessage || (mode === "single"
                ? "Repository ingestion started! This may take a few minutes."
                : "Batch ingestion started! This may take several minutes."
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? (mode === "batch" ? "Discovering & Ingesting..." : "Ingesting...")
                : (mode === "batch" ? `Add ${scopeType === "user" ? "User" : "Org"} Repos` : "Add Repository")
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IntegrationHealthCard({ status }: { status: IntegrationStatus }) {
  if (status.kind === "unauthenticated" || status.kind === "missing_user") {
    return null;
  }

  const installUrl = getGithubInstallUrl();
  const lastEventText = status.lastEventTs ? formatTimestamp(status.lastEventTs) : "Never";
  const lastSyncedText = status.lastSyncedAt ? formatTimestamp(status.lastSyncedAt) : "Never";
  const needsAttention = status.kind !== "healthy";

  const summary =
    status.kind === "healthy"
      ? "GitHub App installed and ingesting events."
      : status.kind === "missing_installation"
      ? "No GitHub App installation detected."
      : status.kind === "no_events"
      ? "No events have been ingested yet."
      : "Ingestion paused—no new events detected.";

  return (
    <div
      className={`rounded-lg border p-4 ${
        needsAttention
          ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100"
      }`}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Integration Health</p>
        <p className="text-sm">{summary}</p>
        <dl className="mt-2 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-amber-900/70 dark:text-amber-100/70">Installations</dt>
            <dd className="text-base font-semibold">{status.installCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-amber-900/70 dark:text-amber-100/70">Last event</dt>
            <dd className="text-sm font-medium">{lastEventText}</dd>
          </div>
          <div>
            <dt className="text-amber-900/70 dark:text-amber-100/70">Last sync</dt>
            <dd className="text-sm font-medium">{lastSyncedText}</dd>
          </div>
        </dl>
        {status.kind === "missing_installation" ? (
          <a
            href={installUrl}
            className="text-sm font-semibold text-amber-900 underline hover:text-amber-700 dark:text-amber-100"
          >
            Open GitHub App install page →
          </a>
        ) : null}
        {status.kind === "no_events" || status.kind === "stale_events" ? (
          <Link
            href="/dashboard/settings/repositories"
            className="text-sm font-semibold text-amber-900 underline hover:text-amber-700 dark:text-amber-100"
          >
            Review tracked repositories →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
