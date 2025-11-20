"use client";

import { useState } from "react";
import { useAction, usePaginatedQuery, useQuery } from "convex/react";
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

  const installations = useQuery(api.installations.listMyInstallations);
  const startBackfill = useAction(api.actions.startBackfill.startBackfill);

  const handleSync = async (installationId: number) => {
    try {
      // eslint-disable-next-line react-hooks/purity
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      await startBackfill({
        installationId,
        repositories: [], // Empty array means "sync all from installation"
        since: ninetyDaysAgo,
      });
      showSuccess("Sync started", "Repository backfill is running in the background.");
    } catch (err) {
      handleConvexError(err as Error);
    }
  };

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Repositories</h1>
          <p className="mt-2 text-sm text-muted font-mono uppercase tracking-wider">
            Configuration / Sources
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-transform hover:scale-105 active:scale-95"
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

      {/* Repositories List */}
      <div className="border-t border-border">
        {status === "LoadingFirstPage" ? (
          <SkeletonRepoList repos={5} />
        ) : repos.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mb-8">
              <div className="mx-auto w-12 h-12 border border-border rounded-full flex items-center justify-center mb-4 bg-surface-muted">
                <span className="text-xl">📦</span>
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No sources configured</h3>
              <p className="text-muted max-w-sm mx-auto text-sm leading-relaxed">
                Connect your GitHub repositories to begin the ingestion process.
              </p>
            </div>

            {installations && installations.length > 0 ? (
              <div className="max-w-lg mx-auto border border-border bg-surface p-6 text-left">
                <h4 className="font-semibold text-sm uppercase tracking-wider text-muted mb-4">Detected Installations</h4>
                <div className="space-y-3">
                  {installations.map(install => (
                    <div key={install._id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <div>
                           <p className="font-medium text-foreground">{install.accountLogin}</p>
                           <p className="text-xs text-muted font-mono">{install.repositories?.length || 0} repos</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSync(install.installationId)}
                        className="text-xs font-medium border border-border px-3 py-1.5 hover:bg-surface-muted transition-colors"
                      >
                        Sync All
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <a
                  href={getGithubInstallUrl()}
                  className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform hover:scale-105"
                >
                  Install GitHub App
                </a>
                <div className="block pt-4">
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="text-xs text-muted hover:text-foreground font-mono uppercase tracking-wider"
                  >
                    or add manually via URL
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
             {/* Header Row */}
             <div className="grid grid-cols-12 gap-4 py-3 px-4 text-[10px] font-mono uppercase tracking-widest text-muted">
                <div className="col-span-5">Repository</div>
                <div className="col-span-2">Owner</div>
                <div className="col-span-2">Language</div>
                <div className="col-span-3 text-right">Updated</div>
             </div>
             
              {repos.map((repo) => (
                <div key={repo._id} className="grid grid-cols-12 gap-4 py-4 px-4 items-center hover:bg-surface-muted/50 transition-colors group">
                  <div className="col-span-5">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/settings/repositories/${repo._id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {repo.name}
                      </Link>
                      {repo.isPrivate && (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono border border-border rounded-sm text-muted uppercase tracking-wide">
                          Private
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-muted mt-1 truncate pr-4">
                        {repo.description}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 text-sm text-foreground-muted">
                    {repo.owner}
                  </div>
                  <div className="col-span-2 text-sm text-foreground-muted font-mono text-xs">
                    {repo.language || "—"}
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-4">
                    <span className="text-xs font-mono text-muted">
                       {new Date(repo.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-3">
                       <Link href={`/dashboard/settings/repositories/${repo._id}`} className="text-xs font-medium hover:text-foreground">Details</Link>
                       <a href={repo.url} target="_blank" rel="noopener" className="text-xs font-medium hover:text-foreground">GitHub ↗</a>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Load More Button */}
        {status !== "LoadingFirstPage" && repos.length > 0 && status !== "Exhausted" && (
          <div className="py-8 text-center">
            <button
              onClick={() => loadMore(50)}
              disabled={status === "LoadingMore"}
              className="inline-flex items-center gap-2 px-6 py-2 border border-border text-sm font-medium hover:bg-surface-muted transition-colors disabled:opacity-50"
            >
              {status === "LoadingMore" ? "Loading..." : "Load More"}
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
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-surface border border-border shadow-2xl max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight">Add Source</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-muted mb-3">
              Ingestion Mode
            </label>
            <div className="flex border border-border divide-x divide-border">
              <button
                type="button"
                onClick={() => setMode("single")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === "single"
                    ? "bg-foreground text-background"
                    : "bg-surface hover:bg-surface-muted"
                }`}
              >
                Single Repo
              </button>
              <button
                type="button"
                onClick={() => setMode("batch")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  mode === "batch"
                    ? "bg-foreground text-background"
                    : "bg-surface hover:bg-surface-muted"
                }`}
              >
                User/Org Batch
              </button>
            </div>
          </div>

          {/* Single Repo Fields */}
          {mode === "single" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Repository Full Name
              </label>
              <input
                type="text"
                value={repoFullName}
                onChange={(e) => setRepoFullName(e.target.value)}
                placeholder="facebook/react"
                required
                className="w-full px-3 py-2 border border-border bg-surface-muted/50 focus:ring-1 focus:ring-foreground focus:border-foreground transition-all outline-none placeholder:text-muted/50"
              />
              <p className="text-xs text-muted mt-2 font-mono">
                Format: owner/repository
              </p>
            </div>
          )}

          {/* Batch Mode Fields */}
          {mode === "batch" && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Scope Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="radio" 
                      name="scopeType" 
                      checked={scopeType === "user"}
                      onChange={() => setScopeType("user")}
                      className="accent-foreground"
                    />
                    User
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="radio" 
                      name="scopeType" 
                      checked={scopeType === "org"}
                      onChange={() => setScopeType("org")}
                      className="accent-foreground"
                    />
                    Organization
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {scopeType === "user" ? "GitHub Username" : "Organization Name"}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={scopeType === "user" ? "torvalds" : "facebook"}
                  required
                  className="w-full px-3 py-2 border border-border bg-surface-muted/50 focus:ring-1 focus:ring-foreground focus:border-foreground transition-all outline-none placeholder:text-muted/50"
                />
              </div>
            </>
          )}

          {/* Since Date */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Ingest Since
            </label>
            <input
              type="date"
              value={sinceDate}
              onChange={(e) => setSinceDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              required
              className="w-full px-3 py-2 border border-border bg-surface-muted/50 focus:ring-1 focus:ring-foreground focus:border-foreground transition-all outline-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Result Message */}
          {resultMessage && !success && (
            <div className="p-3 bg-surface-muted border border-border text-sm text-foreground font-mono text-xs">
              {resultMessage}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-sm text-emerald-600">
              {resultMessage || "Ingestion queued successfully."}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || success}
              className="flex-1 px-4 py-2 bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Processing..." : "Begin Ingestion"}
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
      className={`border p-5 ${
        needsAttention
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-border bg-surface text-foreground"
      }`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
           <p className="text-sm font-semibold uppercase tracking-wider opacity-70">System Status</p>
           <div className={`h-2 w-2 rounded-full ${needsAttention ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
        </div>
        
        <p className="text-sm">{summary}</p>
        
        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3 border-t border-black/5 pt-4 mt-2">
          <div>
            <dt className="text-muted mb-1 font-mono">INSTALLATIONS</dt>
            <dd className="text-base font-semibold">{status.installCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-muted mb-1 font-mono">LAST EVENT</dt>
            <dd className="text-sm font-medium">{lastEventText}</dd>
          </div>
          <div>
            <dt className="text-muted mb-1 font-mono">LAST SYNC</dt>
            <dd className="text-sm font-medium">{lastSyncedText}</dd>
          </div>
        </div>
        
        {status.kind === "missing_installation" && (
          <a
            href={installUrl}
            className="text-sm font-semibold underline decoration-amber-900/30 underline-offset-4 hover:decoration-amber-900"
          >
            Open GitHub App install page →
          </a>
        )}
      </div>
    </div>
  );
}
