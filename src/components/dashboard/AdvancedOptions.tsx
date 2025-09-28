import { useState, useCallback, ChangeEvent } from 'react';
import { Repository } from '@/types/dashboard';

export interface AdvancedOptionsProps {
  repositories: readonly Repository[];
  selectedRepositoryIds: readonly string[];
  onRepositorySelectionChange: (selected: string[]) => void;
  excludeForks?: boolean;
  onExcludeForksChange?: (exclude: boolean) => void;
  filterByLanguage?: string;
  onLanguageFilterChange?: (language: string) => void;
  showPrivateOnly?: boolean;
  onPrivateOnlyChange?: (privateOnly: boolean) => void;
  disabled?: boolean;
}

export default function AdvancedOptions({
  repositories,
  selectedRepositoryIds,
  onRepositorySelectionChange,
  excludeForks = false,
  onExcludeForksChange,
  filterByLanguage = '',
  onLanguageFilterChange,
  showPrivateOnly = false,
  onPrivateOnlyChange,
  disabled = false
}: AdvancedOptionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Get unique languages from repositories
  const availableLanguages = Array.from(
    new Set(repositories.filter(r => r.language).map(r => r.language!))
  ).sort();

  const handleSelectAllRepos = useCallback(() => {
    const allRepoNames = repositories.map(r => r.full_name);
    onRepositorySelectionChange(allRepoNames);
  }, [repositories, onRepositorySelectionChange]);

  const handleClearRepoSelection = useCallback(() => {
    onRepositorySelectionChange([]);
  }, [onRepositorySelectionChange]);

  const handleLanguageChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    onLanguageFilterChange?.(e.target.value);
  }, [onLanguageFilterChange]);

  const handleExcludeForksChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onExcludeForksChange?.(e.target.checked);
  }, [onExcludeForksChange]);

  const handlePrivateOnlyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onPrivateOnlyChange?.(e.target.checked);
  }, [onPrivateOnlyChange]);

  return (
    <div>
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={disabled}
       
        aria-expanded={isExpanded}
        aria-controls="advanced-options-content"
      >
        <span>
          Advanced Options
        </span>
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isExpanded && (
        <div
          id="advanced-options-content">
          {/* Repository Quick Actions */}
          <div>
            <label>
              Repository Selection
            </label>
            <div>
              <button
                type="button"
                onClick={handleSelectAllRepos}
                disabled={disabled}>
                Select All ({repositories.length})
              </button>
              <button
                type="button"
                onClick={handleClearRepoSelection}
                disabled={disabled || selectedRepositoryIds.length === 0}>
                Clear Selection
              </button>
            </div>
          </div>

          {/* Language Filter */}
          {availableLanguages.length > 0 && (
            <div>
              <label
                htmlFor="language-filter">
                Filter by Language
              </label>
              <select
                id="language-filter"
                value={filterByLanguage}
                onChange={handleLanguageChange}
                disabled={disabled}>
                <option value="">All Languages</option>
                {availableLanguages.map(lang => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Repository Type Filters */}
          <div>
            <label>
              Repository Filters
            </label>

            {/* Exclude Forks */}
            <label>
              <input
                type="checkbox"
                checked={excludeForks}
                onChange={handleExcludeForksChange}
                disabled={disabled}
               
              />
              <span>
                Exclude forked repositories
              </span>
            </label>

            {/* Show Private Only */}
            <label>
              <input
                type="checkbox"
                checked={showPrivateOnly}
                onChange={handlePrivateOnlyChange}
                disabled={disabled}
               
              />
              <span>
                Show private repositories only
              </span>
            </label>
          </div>

          {/* Info Text */}
          <div>
            <p>
              These options help refine your repository selection and analysis. Most users won&apos;t need to adjust these settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}