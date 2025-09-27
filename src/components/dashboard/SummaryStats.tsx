import React from 'react';
import { CommitSummary } from '@/types/dashboard';

export interface SummaryStatsProps {
  /**
   * The commit summary data to display statistics for
   */
  summary: CommitSummary;
  
  /**
   * Additional CSS class to apply to the container
   */
  className?: string;
}

/**
 * Displays a dashboard of commit activity statistics
 */
const SummaryStats: React.FC<SummaryStatsProps> = ({ 
  summary,
  className = ''
}) => {
  return (
    <div className={`${className}`}>
      <h3 className="text-sm uppercase mb-3" style={{ color: 'var(--neon-green)' }}>
        METRICS OVERVIEW
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-1.5 rounded-md border relative" style={{ 
          backgroundColor: 'rgba(249, 250, 251, 0.8)',
          borderColor: 'var(--neon-green)',
          boxShadow: '0 0 10px rgba(16, 185, 129, 0.1)'
        }}>
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: 'var(--neon-green)' }}></div>
          <p className="text-xs uppercase mb-1" style={{ color: 'var(--neon-green)' }}>COMMIT COUNT</p>
          <p className="text-3xl font-mono" style={{ color: 'var(--foreground)' }}>
            {summary.stats.totalCommits}
          </p>
        </div>
        <div className="p-1.5 rounded-md border relative" style={{ 
          backgroundColor: 'rgba(249, 250, 251, 0.8)',
          borderColor: 'var(--electric-blue)',
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.1)'
        }}>
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <p className="text-xs uppercase mb-1" style={{ color: 'var(--electric-blue)' }}>REPOSITORIES</p>
          <p className="text-3xl font-mono" style={{ color: 'var(--foreground)' }}>
            {summary.stats.repositories.length}
          </p>
        </div>
        <div className="p-1.5 rounded-md border relative" style={{ 
          backgroundColor: 'rgba(249, 250, 251, 0.8)',
          borderColor: 'var(--luminous-yellow)',
          boxShadow: '0 0 10px rgba(245, 158, 11, 0.1)'
        }}>
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: 'var(--luminous-yellow)' }}></div>
          <p className="text-xs uppercase mb-1" style={{ color: 'var(--luminous-yellow)' }}>ACTIVE DAYS</p>
          <p className="text-3xl font-mono" style={{ color: 'var(--foreground)' }}>
            {summary.stats.dates.length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SummaryStats;