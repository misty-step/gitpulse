import React from 'react';
import Image from 'next/image';

type GroupedResult = {
  groupKey: string;
  groupName: string;
  groupAvatar?: string;
  commitCount: number;
  repositories: string[];
  dates: string[];
  commits: any[];
  aiSummary?: any;
};

type GroupedResultsViewProps = {
  groupedResults: GroupedResult[];
  groupBy: 'contributor' | 'organization' | 'repository' | 'chronological';
  expanded: Record<string, boolean>;
  onToggleExpand: (groupKey: string) => void;
};

export default function GroupedResultsView({
  groupedResults,
  groupBy,
  expanded,
  onToggleExpand
}: GroupedResultsViewProps) {
  if (!groupedResults || groupedResults.length === 0) {
    return (
      <div className="text-center p-2" style={{ color: 'var(--foreground)' }}>
        No results to display.
      </div>
    );
  }

  // For chronological view, just show a message since the regular summary is displayed elsewhere
  if (groupBy === 'chronological') {
    return (
      <div className="text-center p-1.5" style={{ color: 'var(--foreground)' }}>
        <div className="inline-block px-3 py-1 rounded" style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--electric-blue)'
        }}>
          Using chronological view - see overall summary below
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-sm uppercase mb-3" style={{ color: 'var(--neon-green)' }}>
        GROUPED ANALYSIS RESULTS
      </h3>
      
      <div className="grid grid-cols-1 gap-6">
        {groupedResults.map((group) => (
          <div 
            key={group.groupKey}
            className="border rounded-md overflow-hidden"
            style={{ 
              backgroundColor: 'rgba(27, 43, 52, 0.7)',
              backdropFilter: 'blur(5px)',
              borderColor: 'var(--electric-blue)',
              boxShadow: '0 0 15px rgba(59, 142, 234, 0.1)'
            }}
          >
            {/* Group Header */}
            <div className="p-1.5 flex items-center justify-between" style={{ 
              borderBottom: expanded[group.groupKey] ? '1px solid var(--electric-blue)' : 'none'
            }}>
              <div className="flex items-center">
                {group.groupAvatar && (
                  <Image 
                    src={group.groupAvatar}
                    alt={group.groupName}
                    width={32}
                    height={32}
                    className="rounded-full mr-3"
                  />
                )}
                <div>
                  <h4 className="font-bold" style={{ color: 'var(--neon-green)' }}>
                    {group.groupName}
                  </h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded" style={{ 
                      backgroundColor: 'rgba(0, 255, 135, 0.1)',
                      color: 'var(--neon-green)'
                    }}>
                      {group.commitCount} commits
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ 
                      backgroundColor: 'rgba(59, 142, 234, 0.1)',
                      color: 'var(--electric-blue)'
                    }}>
                      {group.repositories.length} repositories
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded" style={{ 
                      backgroundColor: 'rgba(255, 200, 87, 0.1)',
                      color: 'var(--luminous-yellow)'
                    }}>
                      {group.dates.length} days active
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onToggleExpand(group.groupKey)}
                className="p-2 rounded-full"
                style={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  color: 'var(--electric-blue)'
                }}
              >
                <svg 
                  className={`h-5 w-5 transition-transform duration-200 ${expanded[group.groupKey] ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            
            {/* Expanded Content */}
            {expanded[group.groupKey] && (
              <div className="p-1.5">
                {/* Repository List */}
                <div className="mb-6">
                  <h5 className="text-xs uppercase mb-2" style={{ color: 'var(--electric-blue)' }}>
                    REPOSITORIES ({group.repositories.length})
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {group.repositories.map(repo => (
                      <span 
                        key={repo}
                        className="text-xs px-2 py-1 rounded"
                        style={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          color: 'var(--foreground)',
                          border: '1px solid var(--electric-blue)'
                        }}
                      >
                        {repo}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* AI Summary if available */}
                {group.aiSummary ? (
                  <>
                    <h5 className="text-xs uppercase mb-2" style={{ color: 'var(--electric-blue)' }}>
                      AI ANALYSIS
                    </h5>
                    
                    {/* Key Themes */}
                    {group.aiSummary.keyThemes.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-bold mb-1" style={{ color: 'var(--neon-green)' }}>
                          KEY THEMES
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.aiSummary.keyThemes.map((theme: string, index: number) => (
                            <span
                              key={index}
                              className="text-xs px-2 py-1 rounded"
                              style={{ 
                                backgroundColor: 'rgba(0, 255, 135, 0.1)',
                                border: '1px solid var(--neon-green)',
                                color: 'var(--neon-green)'
                              }}
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Technical Areas */}
                    {group.aiSummary.technicalAreas.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-bold mb-1" style={{ color: 'var(--neon-green)' }}>
                          TECHNICAL FOCUS
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.aiSummary.technicalAreas.slice(0, 5).map((area: any, index: number) => (
                            <span
                              key={index}
                              className="text-xs px-2 py-1 rounded flex items-center"
                              style={{ 
                                backgroundColor: 'rgba(59, 142, 234, 0.1)',
                                border: '1px solid var(--electric-blue)',
                                color: 'var(--electric-blue)'
                              }}
                            >
                              {area.name}
                              <span className="ml-1 px-1 rounded" style={{ 
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                              }}>
                                {area.count}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Summary */}
                    <div className="mb-4">
                      <div className="text-xs font-bold mb-1" style={{ color: 'var(--neon-green)' }}>
                        SUMMARY
                      </div>
                      <div className="text-sm" style={{ color: 'var(--foreground)' }}>
                        {group.aiSummary.overallSummary}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm" style={{ color: 'var(--foreground)' }}>
                    No AI summary available for this group.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}