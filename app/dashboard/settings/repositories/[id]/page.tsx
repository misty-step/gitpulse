"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useMemo } from "react";
import { SkeletonRepoDetail } from "@/components/Skeleton";
import { KPICard } from "@/components/KPICard";

export default function RepoDetailPage() {
  const params = useParams();
  const repoId = params.id as Id<"repos">;

  // Default to last 90 days
  const [timeRange, setTimeRange] = useState(90);

  // Activity chart layer toggles
  const [showPRs, setShowPRs] = useState(true);
  const [showCommits, setShowCommits] = useState(true);
  const [showReviews, setShowReviews] = useState(true);

  // Hover state for activity chart
  const [hoveredDay, setHoveredDay] = useState<{ date: string; prs: number; commits: number; reviews: number } | null>(null);

  // Repository details collapsed state
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Event type filter state (for clicking event breakdown rows)
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(new Set());

  // Analytics Timestamp Semantics: Frozen Snapshot
  // Decision: Use frozen snapshot approach (endDate fixed at page load)
  // Rationale: Industry standard for analytics UIs (Google Analytics, GitHub Insights, Amplitude)
  //            Provides consistent data view during exploration - changing timeRange shifts the
  //            window backwards from the same endpoint, preventing confusion from moving target.
  //            User can refresh page to update to latest data.
  const [endDate] = useState(() => Date.now());
  const startDate = useMemo(
    () => endDate - timeRange * 24 * 60 * 60 * 1000,
    [endDate, timeRange]
  );

  // Fetch repository details
  const repo = useQuery(api.repos.getById, { id: repoId });

  // Fetch KPIs with trends for the repository
  const kpis = useQuery(
    api.kpis.getRepoKPIsWithTrends,
    repo
      ? {
          fullName: repo.fullName,
          startDate,
          endDate,
        }
      : "skip"
  );

  // Fetch events for the repository
  const events = useQuery(
    api.events.listByRepo,
    repo
      ? {
          repoId: repo._id,
          startDate,
          endDate,
          limit: 500,
        }
      : "skip"
  );

  // Calculate event breakdown by type
  const eventBreakdown = useMemo(() => {
    if (!events) return [];

    const counts: Record<string, number> = {};
    events.forEach((event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  // Calculate activity over time (daily buckets)
  const activityOverTime = useMemo(() => {
    if (!events) return [];

    // Group events by day
    const dailyCounts: Record<string, { date: string; prs: number; commits: number; reviews: number }> = {};

    events.forEach((event) => {
      const date = new Date(event.ts).toISOString().split("T")[0];
      if (!dailyCounts[date]) {
        dailyCounts[date] = { date, prs: 0, commits: 0, reviews: 0 };
      }

      if (event.type === "pr_opened") {
        dailyCounts[date].prs++;
      } else if (event.type === "commit") {
        dailyCounts[date].commits++;
      } else if (event.type === "review" || event.type === "pr_review") {
        dailyCounts[date].reviews++;
      }
    });

    // Convert to sorted array
    return Object.values(dailyCounts).sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // Calculate max value for chart scaling
  const maxActivityValue = useMemo(() => {
    if (activityOverTime.length === 0) return 1;
    return Math.max(
      ...activityOverTime.map((day) => day.prs + day.commits + day.reviews)
    );
  }, [activityOverTime]);

  // Handler for toggling event type selection
  const toggleEventType = (eventType: string) => {
    setSelectedEventTypes((prev) => {
      const next = new Set(prev);
      if (next.has(eventType)) {
        next.delete(eventType);
      } else {
        next.add(eventType);
      }
      return next;
    });
  };

  // Progressive loading: Show skeleton while loading
  if (repo === undefined) {
    return <SkeletonRepoDetail />;
  }

  if (repo === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-gray-500">Repository not found</p>
        <Link
          href="/dashboard/settings/repositories"
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to Repositories
        </Link>
      </div>
    );
  }

  const totalEvents = eventBreakdown.reduce((sum, { count }) => sum + count, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/settings/repositories"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          ← Back to Repositories
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{repo.fullName}</h1>
            {repo.description && (
              <p className="text-gray-600 mt-2">{repo.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-sm">
              {repo.language && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {repo.language}
                </span>
              )}
              {repo.stars !== undefined && (
                <span className="text-gray-600">⭐ {repo.stars.toLocaleString()}</span>
              )}
              {repo.forks !== undefined && (
                <span className="text-gray-600">🔱 {repo.forks.toLocaleString()}</span>
              )}
            </div>
          </div>
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            View on GitHub →
          </a>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Time range:</span>
          <div className="flex gap-2">
            {[7, 30, 90, 180, 365].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  timeRange === days
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Data snapshot: {new Date(endDate).toLocaleString()} (refresh page for latest data)
        </p>
      </div>

      {/* KPI Cards - Progressive Loading */}
      {kpis === undefined ? (
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="flex items-baseline gap-2 mb-1">
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-12 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          <KPICard
            label="PRs Opened"
            value={kpis.prsOpened}
            trend={kpis.trends.prsOpened}
          />
          <KPICard
            label="Commits"
            value={kpis.commits}
            trend={kpis.trends.commits}
          />
          <KPICard
            label="Reviews"
            value={kpis.reviews}
            trend={kpis.trends.reviews}
          />
          <KPICard
            label="Contributors"
            value={kpis.contributors}
            trend={kpis.trends.contributors}
          />
        </div>
      )}

      {/* Event Breakdown - Progressive Loading */}
      {events === undefined ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Event Breakdown
          </h2>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 rounded-lg border-2 border-transparent bg-white">
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="text-right space-y-1">
                    <div className="h-4 w-12 bg-gray-200 rounded animate-pulse ml-auto" />
                    <div className="h-3 w-16 bg-gray-100 rounded animate-pulse ml-auto" />
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 animate-pulse" />
                <div className="mt-1 h-3 w-24 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Event Breakdown ({totalEvents.toLocaleString()} total)
          </h2>
          {eventBreakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
              <span className="text-3xl">📋</span>
            </div>
            <p className="text-gray-900 font-medium mb-1">No events in this period</p>
            <p className="text-sm text-gray-500 max-w-sm">
              There&apos;s no activity recorded for this time range. Try selecting a longer period or check back later.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventBreakdown.map(({ type, count }) => {
              const percentage = (count / totalEvents) * 100;
              const metadata = getEventTypeMetadata(type);
              const isSelected = selectedEventTypes.has(type);
              const duration = timeRange;
              const rate = count / duration;

              return (
                <button
                  key={type}
                  onClick={() => toggleEventType(type)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-transparent bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{metadata.icon}</span>
                      <span className={`font-medium ${isSelected ? "text-blue-900" : "text-gray-700"}`}>
                        {formatEventType(type)}
                      </span>
                      {isSelected && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                          Active Filter
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                        {count.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {rate.toFixed(1)}/day
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${metadata.bgColor} h-2 rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {percentage.toFixed(1)}% of all events
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </div>
      )}

      {/* Activity Over Time - Progressive Loading */}
      {events === undefined ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Activity Over Time
            </h2>
            <div className="flex items-center gap-2">
              <div className="h-7 w-16 bg-gray-100 rounded animate-pulse" />
              <div className="h-7 w-20 bg-gray-100 rounded animate-pulse" />
              <div className="h-7 w-18 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-48 border-b border-l border-gray-300 pb-2 pl-2 relative">
            <div className="flex items-end justify-between gap-1 h-full">
              {[...Array(30)].map((_, i) => {
                // Generate deterministic "random" height based on index for skeleton consistency
                const height = ((i * 7919) % 70) + 20; // Prime number for pseudo-random distribution
                return (
                  <div
                    key={i}
                    className="flex-1 bg-gray-200 rounded-t animate-pulse"
                    style={{
                      height: `${height}%`,
                      animationDelay: `${i * 30}ms`,
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 px-2">
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Activity Over Time
              </h2>
              {selectedEventTypes.size > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  Filtered by {selectedEventTypes.size} event type{selectedEventTypes.size > 1 ? "s" : ""} •
                  <button
                    onClick={() => setSelectedEventTypes(new Set())}
                    className="ml-1 underline hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                </p>
              )}
            </div>
            {/* Layer Toggles */}
            {activityOverTime.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPRs(!showPRs)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition-all ${
                    showPRs
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded ${showPRs ? "bg-blue-500" : "bg-gray-300"}`} />
                  PRs
                </button>
                <button
                  onClick={() => setShowCommits(!showCommits)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition-all ${
                    showCommits
                      ? "bg-purple-100 text-purple-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded ${showCommits ? "bg-purple-500" : "bg-gray-300"}`} />
                  Commits
                </button>
                <button
                  onClick={() => setShowReviews(!showReviews)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-sm transition-all ${
                    showReviews
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded ${showReviews ? "bg-green-500" : "bg-gray-300"}`} />
                  Reviews
                </button>
              </div>
            )}
          </div>

          {activityOverTime.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-3xl">📊</span>
              </div>
              <p className="text-gray-900 font-medium mb-1">No activity yet</p>
              <p className="text-sm text-gray-500">
                There&apos;s no activity in this time range. Try selecting a different period.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Hover Tooltip */}
              {hoveredDay && (
                <div className="bg-gray-900 text-white px-3 py-2 rounded text-sm">
                  <div className="font-medium mb-1">
                    {new Date(hoveredDay.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="space-y-0.5 text-xs">
                    {showPRs && hoveredDay.prs > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-500 rounded" />
                        <span>{hoveredDay.prs} PRs</span>
                      </div>
                    )}
                    {showCommits && hoveredDay.commits > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-purple-500 rounded" />
                        <span>{hoveredDay.commits} Commits</span>
                      </div>
                    )}
                    {showReviews && hoveredDay.reviews > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded" />
                        <span>{hoveredDay.reviews} Reviews</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Chart */}
              <div className="flex items-end justify-between gap-1 h-48 border-b border-l border-gray-300 pb-2 pl-2 relative">
                {activityOverTime.map((day) => {
                  // Determine which categories to show based on filters
                  let shouldShowPRs = showPRs;
                  let shouldShowCommits = showCommits;
                  let shouldShowReviews = showReviews;

                  // If event types are selected, override the layer toggles
                  if (selectedEventTypes.size > 0) {
                    const hasAnyPRType = ["pr_opened", "pr_closed", "pr_comment"].some(t => selectedEventTypes.has(t));
                    const hasCommitType = selectedEventTypes.has("commit");
                    const hasAnyReviewType = ["review", "pr_review"].some(t => selectedEventTypes.has(t));

                    shouldShowPRs = hasAnyPRType;
                    shouldShowCommits = hasCommitType;
                    shouldShowReviews = hasAnyReviewType;
                  }

                  const visibleTotal = (shouldShowPRs ? day.prs : 0) + (shouldShowCommits ? day.commits : 0) + (shouldShowReviews ? day.reviews : 0);
                  const height = visibleTotal > 0 ? (visibleTotal / maxActivityValue) * 100 : 0;

                  return (
                    <div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer"
                      onMouseEnter={() => setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {shouldShowReviews && day.reviews > 0 && (
                        <div
                          className="w-full bg-green-500 hover:bg-green-600 transition-colors rounded-t"
                          style={{
                            height: `${(day.reviews / visibleTotal) * height}%`,
                          }}
                        />
                      )}
                      {shouldShowCommits && day.commits > 0 && (
                        <div
                          className="w-full bg-purple-500 hover:bg-purple-600 transition-colors"
                          style={{
                            height: `${(day.commits / visibleTotal) * height}%`,
                          }}
                        />
                      )}
                      {shouldShowPRs && day.prs > 0 && (
                        <div
                          className="w-full bg-blue-500 hover:bg-blue-600 transition-colors"
                          style={{
                            height: `${(day.prs / visibleTotal) * height}%`,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Date labels (show first, middle, last) */}
              <div className="flex items-center justify-between text-xs text-gray-500 px-2">
                <span>{new Date(activityOverTime[0].date).toLocaleDateString()}</span>
                {activityOverTime.length > 2 && (
                  <span>
                    {new Date(
                      activityOverTime[Math.floor(activityOverTime.length / 2)].date
                    ).toLocaleDateString()}
                  </span>
                )}
                <span>
                  {new Date(
                    activityOverTime[activityOverTime.length - 1].date
                  ).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Repository Metadata - Collapsible */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <button
          onClick={() => setDetailsExpanded(!detailsExpanded)}
          className="flex items-center justify-between w-full text-left group"
        >
          <h2 className="text-lg font-semibold text-gray-900">
            Repository Details
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
              {detailsExpanded ? "Hide" : "Show"} details
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-all ${
                detailsExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {detailsExpanded && (
          <div className="grid grid-cols-2 gap-4 text-sm mt-4 pt-4 border-t border-gray-200">
            <div>
              <span className="font-medium text-gray-700">Owner:</span>
              <span className="ml-2 text-gray-600">{repo.owner}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Name:</span>
              <span className="ml-2 text-gray-600">{repo.name}</span>
            </div>
            {repo.homepage && (
              <div>
                <span className="font-medium text-gray-700">Homepage:</span>
                <a
                  href={repo.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-blue-600 hover:text-blue-700"
                >
                  {repo.homepage}
                </a>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">Visibility:</span>
              <span className="ml-2 text-gray-600">
                {repo.isPrivate ? "Private" : "Public"}
              </span>
            </div>
            {repo.isFork && (
              <div>
                <span className="font-medium text-gray-700">Fork:</span>
                <span className="ml-2 text-gray-600">Yes</span>
              </div>
            )}
            {repo.isArchived && (
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span className="ml-2 text-orange-600">Archived</span>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <span className="ml-2 text-gray-600">
                {new Date(repo.ghCreatedAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Updated:</span>
              <span className="ml-2 text-gray-600">
                {new Date(repo.ghUpdatedAt).toLocaleDateString()}
              </span>
            </div>
            {repo.ghPushedAt && (
              <div>
                <span className="font-medium text-gray-700">Last Push:</span>
                <span className="ml-2 text-gray-600">
                  {new Date(repo.ghPushedAt).toLocaleDateString()}
                </span>
              </div>
            )}
            {repo.openIssues !== undefined && (
              <div>
                <span className="font-medium text-gray-700">Open Issues:</span>
                <span className="ml-2 text-gray-600">
                  {repo.openIssues.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format event types for display
function formatEventType(type: string): string {
  const typeMap: Record<string, string> = {
    pr_opened: "Pull Requests Opened",
    pr_closed: "Pull Requests Closed",
    pr_review: "PR Reviews",
    review: "Reviews",
    commit: "Commits",
    issue_opened: "Issues Opened",
    issue_closed: "Issues Closed",
    issue_comment: "Issue Comments",
    pr_comment: "PR Comments",
  };
  return typeMap[type] || type;
}

// Helper function to get event type metadata (icon and color)
function getEventTypeMetadata(type: string): { icon: string; color: string; bgColor: string } {
  const metadataMap: Record<string, { icon: string; color: string; bgColor: string }> = {
    pr_opened: { icon: "🔀", color: "text-blue-700", bgColor: "bg-blue-600" },
    pr_closed: { icon: "✅", color: "text-green-700", bgColor: "bg-green-600" },
    pr_review: { icon: "👁️", color: "text-green-700", bgColor: "bg-green-600" },
    review: { icon: "👁️", color: "text-green-700", bgColor: "bg-green-600" },
    commit: { icon: "📝", color: "text-purple-700", bgColor: "bg-purple-600" },
    issue_opened: { icon: "❗", color: "text-orange-700", bgColor: "bg-orange-600" },
    issue_closed: { icon: "✔️", color: "text-gray-700", bgColor: "bg-gray-600" },
    issue_comment: { icon: "💬", color: "text-indigo-700", bgColor: "bg-indigo-600" },
    pr_comment: { icon: "💭", color: "text-cyan-700", bgColor: "bg-cyan-600" },
  };
  return metadataMap[type] || { icon: "📊", color: "text-gray-700", bgColor: "bg-gray-600" };
}
