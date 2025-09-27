import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProgressiveLoading } from '@/hooks/useProgressiveLoading';
import { FixedSizeList as List } from 'react-window';
import IntersectionObserver from './IntersectionObserver';
import LoadMoreButton from '@/components/ui/LoadMoreButton';
import { logger } from '@/lib/logger';
import CommitItem from './dashboard/activityFeed/components/CommitItem';

const MODULE_NAME = 'components:ActivityFeed';

// Define the structure of a commit for the activity feed
export type ActivityCommit = {
  sha: string;
  html_url?: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  repository?: {
    name: string;
    full_name: string;
    html_url?: string;
  };
  contributor?: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

// Props for the activity feed component
interface ActivityFeedProps {
  loadCommits: (cursor: string | null, limit: number) => Promise<{
    data: ActivityCommit[];
    nextCursor?: string | null;
    hasMore: boolean;
  }>;
  initialLoad?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  useInfiniteScroll?: boolean;
  initialLimit?: number;
  additionalItemsPerPage?: number;
  showRepository?: boolean;
  showContributor?: boolean;
  itemHeight?: number;
  maxHeight?: number | string;
}

// CommitItem component has been moved to a separate file:
// src/components/dashboard/activityFeed/components/CommitItem.tsx

export default function ActivityFeed({
  loadCommits,
  initialLoad = true,
  emptyMessage = 'No activity data available for the selected filters.',
  errorMessage = 'Failed to load activity data. Please try again.',
  useInfiniteScroll = true,
  initialLimit = 25,
  additionalItemsPerPage = 25,
  showRepository = true,
  showContributor = true,
  itemHeight = 120, // Default item height
  maxHeight = '70vh' // Default max height for the list
}: ActivityFeedProps) {
  // Set up progressive loading with our custom hook
  const {
    items: commits,
    loading,
    initialLoading,
    incrementalLoading,
    hasMore,
    error,
    loadInitialData,
    loadMore,
    reset
  } = useProgressiveLoading<ActivityCommit>(loadCommits, {
    initialLimit,
    additionalItemsPerPage,
    infiniteScroll: useInfiniteScroll
  });

  // Track if we can trigger infinite scrolling (prevents multiple triggers)
  const [canTriggerInfiniteScroll, setCanTriggerInfiniteScroll] = useState(true);
  
  // Track newly loaded items for animations
  const [newItemsCount, setNewItemsCount] = useState(0);
  const prevCommitsLength = useRef(0);
  
  // Track window width to adjust List width
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [listWidth, setListWidth] = useState(0);
  
  // On window resize, update the width
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (listContainerRef.current) {
        setListWidth(listContainerRef.current.offsetWidth);
      }
    };
    
    // Initial width measurement
    if (listContainerRef.current) {
      setListWidth(listContainerRef.current.offsetWidth);
    }
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load initial data when component mounts
  useEffect(() => {
    if (initialLoad) {
      logger.debug(MODULE_NAME, 'Initial load triggered', {
        initialLimit,
        useInfiniteScroll
      });
      
      loadInitialData()
        .catch(initialError => {
          // Extra safety to log initial load errors
          logger.error(MODULE_NAME, 'Error during initial data load', { initialError });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoad]);
  
  // Track new items for animations
  useEffect(() => {
    if (commits.length > prevCommitsLength.current) {
      setNewItemsCount(commits.length - prevCommitsLength.current);
      prevCommitsLength.current = commits.length;
      
      // Reset the new items counter after animation completes
      const timer = setTimeout(() => {
        setNewItemsCount(0);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [commits.length]);

  // Handler for intersection observer callback
  const handleIntersect = useCallback(() => {
    if (canTriggerInfiniteScroll && hasMore && !loading) {
      logger.debug(MODULE_NAME, 'Intersection triggered, loading more items', {
        currentItemCount: commits.length,
        canLoadMore: hasMore,
        isCurrentlyLoading: loading
      });
      
      setCanTriggerInfiniteScroll(false);
      loadMore()
        .catch(loadError => {
          // Extra safety to ensure errors in loadMore are logged
          logger.error(MODULE_NAME, 'Error while loading more items in intersection handler', { loadError });
        })
        .finally(() => {
          // Re-enable infinite scroll trigger after loading completes
          setTimeout(() => setCanTriggerInfiniteScroll(true), 300);
        });
    }
  }, [canTriggerInfiniteScroll, hasMore, loading, loadMore, commits.length]);

  // Reset component when filters change
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);
  
  // Calculate appropriate list height
  const calculateListHeight = () => {
    if (typeof maxHeight === 'number') {
      return Math.min(maxHeight, commits.length * itemHeight);
    }
    // If maxHeight is a string (like 70vh), use that directly
    return maxHeight;
  };

  /**
   * Safely formats any error message for display
   * Ensures we never have "Cannot read properties of undefined" errors
   * 
   * @param errorValue - The error value from the hook (could be any type)
   * @param defaultMessage - Fallback message if error can't be processed
   * @returns A safe string to display to the user
   */
  const getSafeErrorMessage = (errorValue: unknown, defaultMessage: string): string => {
    try {
      // Handle null/undefined case
      if (errorValue === null || errorValue === undefined) {
        return defaultMessage;
      }

      // Handle string case directly
      if (typeof errorValue === 'string') {
        return errorValue.trim() || defaultMessage;
      }

      // Handle Error instance
      if (errorValue instanceof Error) {
        return errorValue.message || defaultMessage;
      }

      // Handle object with message property
      if (typeof errorValue === 'object') {
        const errObj = errorValue as Record<string, unknown>;
        
        // Try to get .message property
        if ('message' in errObj && typeof errObj.message === 'string') {
          return errObj.message.trim() || defaultMessage;
        }
        
        // Try to stringify (with safety checks)
        try {
          const serialized = JSON.stringify(errObj);
          if (serialized && serialized !== '{}' && serialized !== '[]') {
            // Truncate if needed for UI display
            if (serialized.length > 50) {
              return serialized.substring(0, 50) + '...';
            }
            return serialized;
          }
        } catch (jsonError) {
          logger.warn(MODULE_NAME, 'Failed to stringify error for display', { jsonError });
        }
      }

      // Fallback for any other case
      return defaultMessage;
    } catch (formattingError) {
      // Log any unexpected errors in our error formatter itself
      logger.error(MODULE_NAME, 'Error while formatting error message', { 
        formattingError,
        originalError: errorValue 
      });
      
      // Always return something safe
      return defaultMessage;
    }
  };

  // Handle error states
  if (error) {
    // Safely format the error message to prevent any "Cannot read properties of undefined" issues
    const safeErrorMessage = getSafeErrorMessage(error, 'An unknown error occurred');
    
    // Log the error with additional context
    logger.warn(MODULE_NAME, 'Displaying error in ActivityFeed', {
      errorType: typeof error,
      originalError: error,
      formattedMessage: safeErrorMessage
    });
    
    // Combine with the component's default error message
    const fullErrorMessage = `${errorMessage}${safeErrorMessage ? `: ${safeErrorMessage}` : ''}`;
    
    return (
      <div className="p-1.5 rounded-md border" style={{
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'var(--crimson-red)',
        color: 'var(--crimson-red)'
      }}>
        <div className="flex items-start">
          <svg className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>{fullErrorMessage}</div>
        </div>
      </div>
    );
  }

  // Handle empty states
  if (!loading && commits.length === 0) {
    return (
      <div className="py-8 text-center" style={{ color: 'var(--foreground)' }}>
        <div className="inline-block p-3 rounded-md border mb-3" style={{
          backgroundColor: 'rgba(249, 250, 251, 0.8)',
          borderColor: 'var(--electric-blue)'
        }}>
          <svg className="h-6 w-6 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--electric-blue)' }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <div className="text-sm">{emptyMessage}</div>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (initialLoading && commits.length === 0) {
    return (
      <div className="py-8 flex justify-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ 
            borderColor: 'var(--electric-blue)', 
            borderTopColor: 'transparent' 
          }}></div>
          <div style={{ color: 'var(--electric-blue)' }}>Loading activity data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Incremental loading indicator at the top */}
      {incrementalLoading && commits.length > 0 && (
        <div className="relative w-full">
          <div 
            className="absolute top-0 left-0 right-0 animate-incremental-loading" 
            style={{ 
              backgroundColor: 'var(--neon-green)',
              zIndex: 10
            }}
          ></div>
          <div className="flex justify-center p-2">
            <div className="text-xs flex items-center" style={{ color: 'var(--neon-green)' }}>
              <span className="inline-block w-3 h-3 mr-2 border-2 border-t-transparent rounded-full animate-spin" 
                style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></span>
              Loading more activity data...
            </div>
          </div>
        </div>
      )}
      
      {/* Activity Timeline with virtualized list */}
      {commits.length > 0 && (
        <div className="relative" ref={listContainerRef}>
          {/* List Container - used to measure width */}
          <div className="relative" style={{ 
            width: '100%',
            height: calculateListHeight()
          }}>
            {/* Global vertical timeline line - just for visual effect */}
            <div className="absolute left-5 top-0 bottom-0 w-0.5 z-0" style={{ 
              backgroundColor: 'var(--electric-blue)',
              opacity: 0.2
            }}></div>
            
            {/* Virtualized List */}
            {listWidth > 0 && (
              <List
                height={typeof calculateListHeight() === 'string' ? windowWidth * 0.7 : calculateListHeight() as number}
                width={listWidth}
                itemCount={commits.length}
                itemSize={itemHeight}
                overscanCount={5}
                className="scrollbar-custom" 
              >
                {({ index, style }) => (
                  <CommitItem
                    key={commits[index].sha}
                    commit={commits[index]}
                    showRepository={showRepository}
                    showContributor={showContributor}
                    style={style}
                    isNew={index >= commits.length - newItemsCount}
                  />
                )}
              </List>
            )}
          </div>
          
          {/* Load more section - either infinite scroll or button */}
          {hasMore && (
            <>
              {useInfiniteScroll ? (
                <IntersectionObserver 
                  onIntersect={handleIntersect}
                  rootMargin="200px"
                  enabled={canTriggerInfiniteScroll && hasMore && !loading}
                >
                  <div className="h-16 flex items-center justify-center mt-2">
                    {incrementalLoading && (
                      <div className="text-xs flex items-center" style={{ color: 'var(--neon-green)' }}>
                        <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2" 
                          style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></div>
                        <div>
                          Loading
                          <span className="inline-block animate-pulse">.</span>
                          <span className="inline-block animate-pulse" style={{ animationDelay: '0.3s' }}>.</span>
                          <span className="inline-block animate-pulse" style={{ animationDelay: '0.6s' }}>.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </IntersectionObserver>
              ) : (
                <LoadMoreButton
                  onClick={loadMore}
                  loading={incrementalLoading}
                  hasMore={hasMore}
                  className="mt-3"
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}