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
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={disabled}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-controls="advanced-options-content"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Advanced Options
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
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
          id="advanced-options-content"
          className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 space-y-4"
        >
          {/* Repository Quick Actions */}
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
              Repository Selection
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAllRepos}
                disabled={disabled}
                className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                Select All ({repositories.length})
              </button>
              <button
                type="button"
                onClick={handleClearRepoSelection}
                disabled={disabled || selectedRepositoryIds.length === 0}
                className="text-xs px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>

          {/* Language Filter */}
          {availableLanguages.length > 0 && (
            <div>
              <label
                htmlFor="language-filter"
                className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block"
              >
                Filter by Language
              </label>
              <select
                id="language-filter"
                value={filterByLanguage}
                onChange={handleLanguageChange}
                disabled={disabled}
                className="w-full text-sm px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
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
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block">
              Repository Filters
            </label>

            {/* Exclude Forks */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={excludeForks}
                onChange={handleExcludeForksChange}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Exclude forked repositories
              </span>
            </label>

            {/* Show Private Only */}
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrivateOnly}
                onChange={handlePrivateOnlyChange}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Show private repositories only
              </span>
            </label>
          </div>

          {/* Info Text */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              These options help refine your repository selection and analysis. Most users won&apos;t need to adjust these settings.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}