import React from 'react';

/**
 * Props for the LoadMoreButton component
 */
interface LoadMoreButtonProps {
  /**
   * Function to call when the button is clicked
   */
  onClick: () => void;
  
  /**
   * Whether the button is in loading state
   * When true, the button will show a loading spinner and be disabled
   */
  loading: boolean;
  
  /**
   * Whether there are more items to load
   * When false, the button will not be rendered
   */
  hasMore: boolean;
  
  /**
   * Additional CSS classes to apply to the container
   */
  className?: string;
  
  /**
   * Custom text to display when button is in normal state
   * @default "LOAD MORE"
   */
  loadText?: string;
  
  /**
   * Custom text to display when button is in loading state
   * @default "LOADING"
   */
  loadingText?: string;
}

/**
 * A button component for loading more items in a paginated list.
 * 
 * The button has three states:
 * - Default: Shows "LOAD MORE" text with an icon
 * - Loading: Shows a loading spinner with "LOADING..." text and is disabled
 * - Hidden: Not rendered when there are no more items to load (hasMore is false)
 * 
 * @example
 * ```tsx
 * <LoadMoreButton
 *   onClick={() => loadMoreData()}
 *   loading={isLoading}
 *   hasMore={hasMoreData}
 * />
 * ```
 */
export default function LoadMoreButton({
  onClick,
  loading,
  hasMore,
  className = '',
  loadText = 'LOAD MORE',
  loadingText = 'LOADING'
}: LoadMoreButtonProps) {
  // Don't render if there's nothing more to load
  if (!hasMore) return null;

  // Base colors - using high contrast values as defaults
  const darkSlate = 'var(--dark-slate, #1b2b34)';
  const electricBlue = 'var(--electric-blue, #3b8eea)';

  return (
    <div className={`flex justify-center py-1.5 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className={`
          px-5 py-2 rounded-md text-sm font-medium transition-all duration-200 
          flex items-center focus:outline-none focus:ring-2 focus:ring-offset-2
          hover:bg-electric-blue hover:text-dark-slate
          focus:ring-electric-blue
        `}
        style={{
          backgroundColor: loading ? 'rgba(0, 0, 0, 0.3)' : darkSlate,
          color: electricBlue,
          border: `1px solid ${electricBlue}`,
          boxShadow: loading ? 'none' : '0 0 10px rgba(59, 142, 234, 0.2)',
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
          // Use type assertion for CSS custom properties
          ...({"--tw-ring-color": electricBlue} as React.CSSProperties),
          ...({"--tw-ring-offset-color": darkSlate} as React.CSSProperties)
        }}
      >
        {loading ? (
          <>
            <span 
              className="mr-2 inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" 
              style={{ borderColor: electricBlue, borderTopColor: 'transparent' }}
              aria-hidden="true"
            ></span>
            <span className="relative">
              {loadingText}
              <span className="absolute -right-4 top-0" aria-hidden="true">
                <span className="animate-pulse">.</span>
                <span className="animate-pulse" style={{ animationDelay: '0.3s' }}>.</span>
                <span className="animate-pulse" style={{ animationDelay: '0.6s' }}>.</span>
              </span>
            </span>
          </>
        ) : (
          <>
            {loadText}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-4 w-4 ml-2" 
              viewBox="0 0 20 20" 
              fill="currentColor"
              aria-hidden="true"
              role="img"
              aria-label="Load more icon"
            >
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}