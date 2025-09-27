import React from 'react';

/**
 * Skeleton loader for the SummaryView component
 * Shows animated placeholders while the actual summary is being generated
 */
export default function SummarySkeletonLoader() {
  return (
    <div className="mt-8 border rounded-lg p-2" style={{
      backgroundColor: 'rgba(249, 250, 251, 0.95)',
      backdropFilter: 'blur(5px)',
      borderColor: 'var(--electric-blue)',
      boxShadow: '0 0 20px rgba(59, 130, 246, 0.15)'
    }}>
      {/* Terminal-like header skeleton */}
      <div className="flex items-center justify-between mb-6 border-b pb-3" style={{ borderColor: 'var(--electric-blue)' }}>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        <div className="px-2 py-1 text-xs rounded flex items-center" style={{
          backgroundColor: 'rgba(249, 250, 251, 0.8)',
          border: '1px solid var(--neon-green)',
          color: 'var(--neon-green)'
        }}>
          <span className="inline-block w-2 h-2 rounded-full mr-2 animate-spin" style={{
            backgroundColor: 'var(--neon-green)',
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'var(--neon-green)',
            borderLeftColor: 'var(--neon-green)'
          }}></span>
          <span>ANALYZING...</span>
        </div>
      </div>

      {/* Activity Feed skeleton */}
      <div className="mb-8">
        <div className="flex items-center mb-3">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            LOADING COMMIT ACTIVITY
          </h3>
        </div>

        {/* Skeleton commit items */}
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-3 rounded-lg bg-white dark:bg-gray-800 animate-pulse">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary skeleton */}
      <div className="border-t pt-6" style={{ borderColor: 'var(--electric-blue)' }}>
        <div className="flex items-center mb-4">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--neon-green)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--neon-green)' }}>
            GENERATING AI INSIGHTS
          </h3>
        </div>

        <div className="space-y-4 animate-pulse">
          {/* Key themes skeleton */}
          <div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              ))}
            </div>
          </div>

          {/* Summary text skeleton */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-6 flex justify-center">
        <div className="text-sm flex items-center gap-2" style={{ color: 'var(--electric-blue)' }}>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <span>Processing commits and generating summary...</span>
        </div>
      </div>
    </div>
  );
}