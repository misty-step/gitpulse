import React from 'react';
import Image from 'next/image';
import { ActivityCommit } from '@/components/ActivityFeed';

interface CommitItemProps {
  commit: ActivityCommit;
  showRepository: boolean;
  showContributor: boolean;
  style?: React.CSSProperties;
  isNew?: boolean;
}

/**
 * Component to render an individual commit item in the activity feed
 */
const CommitItem = React.memo(({
  commit,
  showRepository,
  showContributor,
  style,
  isNew = false
}: CommitItemProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Extract first line of commit message for the title
  const commitTitle = commit.commit.message.split('\n')[0];

  return (
    <div 
      className={`pl-12 relative ${isNew ? 'animate-fadeIn' : ''}`}
      style={{
        ...style,
        // Adding some left padding for the timeline element
        paddingLeft: '3.5rem',
      }}
    >
      {/* Timeline dot */}
      <div className="absolute left-4 top-3 w-3 h-3 rounded-full border-2" style={{ 
        backgroundColor: 'var(--dark-slate)',
        borderColor: 'var(--electric-blue)',
        zIndex: 1
      }}></div>
      
      {/* Vertical timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ 
        backgroundColor: 'var(--electric-blue)',
        opacity: 0.4
      }}></div>
      
      {/* Commit card with simplified design */}
      <div className={`border rounded-md p-3 mb-3 ${isNew ? 'animate-pulse-highlight animate-border-pulse' : ''}`} style={{ 
        backgroundColor: 'rgba(249, 250, 251, 0.95)',
        backdropFilter: 'blur(5px)',
        borderColor: 'var(--electric-blue)',
        boxShadow: '0 0 10px rgba(59, 130, 246, 0.1)'
      }}>
        {/* Commit header with author and date */}
        <div className="flex justify-between items-start mb-2 flex-wrap">
          <div className="flex items-center mr-2">
            {showContributor && commit.contributor && (
              <div className="flex items-center">
                {commit.contributor.avatarUrl ? (
                  <Image 
                    src={commit.contributor.avatarUrl}
                    alt={commit.contributor.displayName}
                    width={20}
                    height={20}
                    className="rounded-full mr-2"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full mr-2 flex items-center justify-center" style={{ 
                    backgroundColor: 'var(--electric-blue)',
                    color: 'var(--dark-slate)',
                    fontSize: '0.75rem'
                  }}>
                    {commit.contributor.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="font-bold text-sm truncate max-w-48" style={{ color: 'var(--electric-blue)' }}>
                  {commit.contributor.displayName}
                </span>
              </div>
            )}
            
            {!showContributor && (
              <div className="flex items-center">
                <span className="font-bold text-sm truncate max-w-48" style={{ color: 'var(--electric-blue)' }}>
                  {commit.commit.author.name}
                </span>
              </div>
            )}
          </div>
          
          <div className="text-xs" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
            {formatDate(commit.commit.author.date)}
          </div>
        </div>
        
        {/* Repository info if needed - condensed */}
        {showRepository && commit.repository && (
          <div className="mb-2">
            <a 
              href={commit.repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-1.5 py-0.5 rounded inline-flex items-center"
              style={{ 
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--neon-green)',
                border: '1px solid var(--neon-green)',
                textDecoration: 'none'
              }}
            >
              <svg className="h-2.5 w-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" clipRule="evenodd" />
              </svg>
              {commit.repository.full_name}
            </a>
          </div>
        )}
        
        {/* Commit message */}
        <div className="text-sm" style={{ color: 'var(--foreground)' }}>
          <a 
            href={commit.html_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none' }}
            className="hover:underline"
          >
            {commitTitle}
          </a>
        </div>
      </div>
    </div>
  );
});

CommitItem.displayName = 'CommitItem';

export default CommitItem;