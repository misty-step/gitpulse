/**
 * Skeleton loading components
 *
 * Provides visual feedback during data fetching.
 * Uses pulse animation for smooth UX.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-neutral-700 ${className}`}
      aria-label="Loading..."
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="w-full">
      {/* Table header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-200 dark:divide-neutral-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4">
            <div className="flex gap-4 items-center">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonActivityFeed({ items = 5 }: { items?: number }) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <li key={i} className="flex items-start gap-3">
          <Skeleton className="w-6 h-6 rounded flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-32" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SkeletonRepoList({ repos = 5 }: { repos?: number }) {
  return (
    <table className="w-full">
      <thead className="border-b border-gray-200 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900">
        <tr>
          <th className="px-6 py-3 text-left">
            <Skeleton className="h-3 w-24" />
          </th>
          <th className="px-6 py-3 text-left">
            <Skeleton className="h-3 w-16" />
          </th>
          <th className="px-6 py-3 text-left">
            <Skeleton className="h-3 w-20" />
          </th>
          <th className="px-6 py-3 text-left">
            <Skeleton className="h-3 w-24" />
          </th>
          <th className="px-6 py-3 text-left">
            <Skeleton className="h-3 w-20" />
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
        {Array.from({ length: repos }).map((_, i) => (
          <tr key={i}>
            <td className="px-6 py-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-2" />
            </td>
            <td className="px-6 py-4">
              <Skeleton className="h-5 w-20" />
            </td>
            <td className="px-6 py-4">
              <Skeleton className="h-5 w-24" />
            </td>
            <td className="px-6 py-4">
              <Skeleton className="h-5 w-28" />
            </td>
            <td className="px-6 py-4 space-x-3 flex">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-16" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SkeletonKPICard() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function SkeletonRepoDetail() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-10 w-96 mt-2" />
        <Skeleton className="h-5 w-full max-w-2xl mt-3" />
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
        <SkeletonKPICard />
      </div>

      {/* Charts skeleton */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </div>
      </div>
    </div>
  );
}
