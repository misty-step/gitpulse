import React from 'react';
import { AISummary } from '@/types/dashboard';

export interface SummaryDetailsProps {
  /**
   * AI summary data to display
   */
  aiSummary: AISummary;
  
  /**
   * Additional CSS class to apply to the container
   */
  className?: string;
}

/**
 * Displays detailed AI-generated analysis of GitHub activity
 */
const SummaryDetails: React.FC<SummaryDetailsProps> = ({ 
  aiSummary,
  className = ''
}) => {
  return (
    <div className={className}>
      {/* Key Themes */}
      <div className="mb-8">
        <div className="flex items-center mb-3">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            IDENTIFIED PATTERNS
          </h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {aiSummary.keyThemes.map((theme, index) => (
            <span
              key={index}
              className="px-3 py-1 rounded-md text-sm"
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

      {/* Technical Areas */}
      <div className="mb-8">
        <div className="flex items-center mb-3">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            TECHNICAL FOCUS AREAS
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiSummary.technicalAreas.map((area, index) => (
            <div
              key={index}
              className="flex justify-between items-center p-3 rounded-md"
              style={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--electric-blue)'
              }}
            >
              <span style={{ color: 'var(--foreground)' }}>{area.name}</span>
              <span className="px-2 py-1 rounded text-xs" style={{ 
                backgroundColor: 'rgba(59, 142, 234, 0.2)',
                color: 'var(--electric-blue)'
              }}>
                {area.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Accomplishments */}
      <div className="mb-8">
        <div className="flex items-center mb-3">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            KEY ACHIEVEMENTS
          </h3>
        </div>
        <div className="border rounded-md p-1.5" style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderColor: 'var(--neon-green)'
        }}>
          <ul className="space-y-3" style={{ color: 'var(--foreground)' }}>
            {aiSummary.accomplishments.map((accomplishment, index) => (
              <li key={index} className="flex items-start">
                <span className="inline-block w-5 flex-shrink-0 mr-2" style={{ color: 'var(--neon-green)' }}>→</span>
                <span>{accomplishment}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Commit Types */}
      <div className="mb-8">
        <div className="flex items-center mb-3">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            COMMIT CLASSIFICATION
          </h3>
        </div>
        <div className="space-y-4">
          {aiSummary.commitsByType.map((type, index) => (
            <div key={index} className="border-l-2 pl-4 py-1" style={{ borderColor: 'var(--neon-green)' }}>
              <div className="flex justify-between items-center">
                <h4 className="font-medium" style={{ color: 'var(--neon-green)' }}>
                  {type.type}
                </h4>
                <span className="text-xs px-2 py-1 rounded" style={{ 
                  backgroundColor: 'rgba(0, 255, 135, 0.1)',
                  color: 'var(--neon-green)'
                }}>
                  {type.count}
                </span>
              </div>
              <p className="text-sm mt-1" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {type.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="mb-8">
        <div className="flex items-center mb-3">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            TEMPORAL ANALYSIS
          </h3>
        </div>
        <div className="space-y-4">
          {aiSummary.timelineHighlights.map((highlight, index) => (
            <div key={index} className="flex border-b pb-3" style={{ borderColor: 'rgba(59, 142, 234, 0.2)' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mr-3" style={{ 
                backgroundColor: 'rgba(59, 142, 234, 0.1)',
                border: '1px solid var(--electric-blue)',
                color: 'var(--electric-blue)'
              }}>
                {index + 1}
              </div>
              <div>
                <div className="text-xs font-mono mb-1" style={{ color: 'var(--electric-blue)' }}>
                  {new Date(highlight.date).toLocaleDateString()}
                </div>
                <div style={{ color: 'var(--foreground)' }}>
                  {highlight.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Summary */}
      <div>
        <div className="flex items-center mb-3">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            COMPREHENSIVE ANALYSIS
          </h3>
        </div>
        <div className="p-1.5 rounded-md border" style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderColor: 'var(--neon-green)',
          color: 'var(--foreground)'
        }}>
          <div className="text-xs mb-2 font-mono" style={{ color: 'var(--neon-green)' }}>
            $ AI_ANALYSIS --detailed-output
          </div>
          {aiSummary.overallSummary}
        </div>
      </div>
    </div>
  );
};

export default SummaryDetails;