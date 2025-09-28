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
    <article>
      {/* Timeline dot */}
      <div></div>
      
      {/* Vertical timeline line */}
      <div></div>
      
      {/* Commit card with simplified design */}
      <div>
        {/* Commit header with author and date */}
        <div>
          <div>
            {showContributor && commit.contributor && (
              <div>
                {commit.contributor.avatarUrl ? (
                  <Image 
                    src={commit.contributor.avatarUrl}
                    alt={commit.contributor.displayName}
                    width={20}
                    height={20}
                   
                  />
                ) : (
                  <div>
                    {commit.contributor.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span>
                  {commit.contributor.displayName}
                </span>
              </div>
            )}
            
            {!showContributor && (
              <div>
                <span>
                  {commit.commit.author.name}
                </span>
              </div>
            )}
          </div>
          
          <div>
            {formatDate(commit.commit.author.date)}
          </div>
        </div>
        
        {/* Repository info if needed - condensed */}
        {showRepository && commit.repository && (
          <div>
            <a 
              href={commit.repository.html_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" clipRule="evenodd" />
              </svg>
              {commit.repository.full_name}
            </a>
          </div>
        )}
        
        {/* Commit message */}
        <div>
          <a 
            href={commit.html_url}
            target="_blank"
            rel="noopener noreferrer">
            {commitTitle}
          </a>
        </div>
      </div>
    </article>
  );
});

CommitItem.displayName = 'CommitItem';

export default CommitItem;