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
    <section>
        <div>
          <div></div>
          <h3>
            IDENTIFIED PATTERNS
          </h3>
        </div>
        <div>
          {aiSummary.keyThemes.map((theme, index) => (
            <span
              key={index}>
              {theme}
            </span>
          ))}
        </div>
      </div>

      {/* Technical Areas */}
      <div>
        <div>
          <div></div>
          <h3>
            TECHNICAL FOCUS AREAS
          </h3>
        </div>
        <div>
          {aiSummary.technicalAreas.map((area, index) => (
            <div
              key={index}>
              <span>{area.name}</span>
              <span>
                {area.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Accomplishments */}
      <div>
        <div>
          <div></div>
          <h3>
            KEY ACHIEVEMENTS
          </h3>
        </div>
        <div>
          <ul>
            {aiSummary.accomplishments.map((accomplishment, index) => (
              <li key={index>
                <span>→</span>
                <span>{accomplishment}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Commit Types */}
      <div>
        <div>
          <div></div>
          <h3>
            COMMIT CLASSIFICATION
          </h3>
        </div>
        <div>
          {aiSummary.commitsByType.map((type, index) => (
            <div key={index>
              <div>
                <h4>
                  {type.type}
                </h4>
                <span>
                  {type.count}
                </span>
              </div>
              <p>
                {type.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div>
          <div></div>
          <h3>
            TEMPORAL ANALYSIS
          </h3>
        </div>
        <div>
          {aiSummary.timelineHighlights.map((highlight, index) => (
            <div key={index>
              <div>
                {index + 1}
              </div>
              <div>
                <div>
                  {new Date(highlight.date).toLocaleDateString()}
                </div>
                <div>
                  {highlight.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Summary */}
      <div>
        <div>
          <div></div>
          <h3>
            COMPREHENSIVE ANALYSIS
          </h3>
        </div>
        <div>
          <div>
            $ AI_ANALYSIS --detailed-output
          </div>
          {aiSummary.overallSummary}
        </div>
      </div>
    </section>
  );
};

export default SummaryDetails;