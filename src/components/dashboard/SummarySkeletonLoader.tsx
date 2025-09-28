import React from 'react';

/**
 * Skeleton loader for the SummaryView component
 * Shows animated placeholders while the actual summary is being generated
 */
export default function SummarySkeletonLoader() {
  return (
    <div>
      {/* Terminal-like header skeleton */}
      <div>
        <div>
          <div></div>
          <div></div>
        </div>
        <div>
          <span></span>
          <span>ANALYZING...</span>
        </div>
      </div>

      {/* Activity Feed skeleton */}
      <div>
        <div>
          <div></div>
          <h3>
            LOADING COMMIT ACTIVITY
          </h3>
        </div>

        {/* Skeleton commit items */}
        <div>
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div></div>
              <div>
                <div></div>
                <div></div>
                <div></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats skeleton */}
      <div>
        <div>
          {[1, 2, 3, 4].map(i => (
            <div key={i}>
              <div></div>
              <div></div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Summary skeleton */}
      <div>
        <div>
          <div></div>
          <h3>
            GENERATING AI INSIGHTS
          </h3>
        </div>

        <div>
          {/* Key themes skeleton */}
          <div>
            <div></div>
            <div>
              {[1, 2, 3].map(i => (
                <div key={i}></div>
              ))}
            </div>
          </div>

          {/* Summary text skeleton */}
          <div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div>
        <div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle
             
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
             
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