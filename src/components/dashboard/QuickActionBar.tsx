import React from 'react';
import { LastGenerationParams } from '@/hooks/useLastGenerationParams';

export interface QuickActionBarProps {
  /**
   * Last generation parameters if available
   */
  lastGeneration: LastGenerationParams | null;

  /**
   * Whether the summary is being generated
   */
  loading: boolean;

  /**
   * Callback to regenerate with last parameters
   */
  onRegenerateLast: () => void;
}

/**
 * Quick action bar that provides one-click regeneration with previous parameters
 */
export default function QuickActionBar({
  lastGeneration,
  loading,
  onRegenerateLast
}: QuickActionBarProps) {
  // Don't show if no last generation params
  if (!lastGeneration) {
    return null;
  }

  // Format the time since last generation
  const formatTimeSince = (timestamp: number): string => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return 'yesterday';
  };

  // Create description of what will be regenerated
  const getDescription = (): string => {
    const { activityMode, selectedRepositoryIds } = lastGeneration;
    const repoCount = selectedRepositoryIds.length;

    switch (activityMode) {
      case 'my-activity':
        return `your activity across ${repoCount} ${repoCount === 1 ? 'repo' : 'repos'}`;
      case 'team-activity':
        const memberCount = lastGeneration.contributors.length;
        return `${memberCount} ${memberCount === 1 ? 'member' : 'members'} across ${repoCount} ${repoCount === 1 ? 'repo' : 'repos'}`;
      case 'my-work-activity':
        const orgCount = lastGeneration.organizations.length;
        return `${orgCount} ${orgCount === 1 ? 'org' : 'orgs'} with ${repoCount} ${repoCount === 1 ? 'repo' : 'repos'}`;
      default:
        return `${repoCount} ${repoCount === 1 ? 'repo' : 'repos'}`;
    }
  };

  return (
    <nav>
      <button
        type="button"
        onClick={onRegenerateLast}
        disabled={loading}
        title={`Regenerate the same summary from ${formatTimeSince(lastGeneration.timestamp)}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
         
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
            clipRule="evenodd"
          />
        </svg>
        <span>Regenerate Last:</span>
        <span>{getDescription()}</span>
        <span>Regenerate</span>
      </button>

      <span>
        ({formatTimeSince(lastGeneration.timestamp)})
      </span>
    </nav>
  );
}