import { useCallback, useEffect, useMemo, useState, ChangeEvent } from 'react';
import ModeSelector, { ActivityMode } from '@/components/ui/ModeSelector';
import { DateRange, Repository } from '@/types/dashboard';

export type DatePreset = 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

export interface CompactToolbarProps {
  activityMode: ActivityMode;
  onModeChange: (mode: ActivityMode) => void;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  loading: boolean;
  progressMessage?: string;
  repositories: readonly Repository[];
  selectedRepositoryIds: readonly string[];
  contributors: readonly string[];
  userName?: string | null;
  onGenerate: () => void;
}

interface PresetOption {
  id: DatePreset;
  label: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom', label: 'Custom range' }
];

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const createPresetRange = (preset: DatePreset): DateRange => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'last7': {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      return { since: formatDate(start), until: formatDate(today) };
    }
    case 'last30': {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      return { since: formatDate(start), until: formatDate(today) };
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { since: formatDate(start), until: formatDate(today) };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { since: formatDate(start), until: formatDate(end) };
    }
    default:
      return { since: formatDate(today), until: formatDate(today) };
  }
};

const detectPreset = (range: DateRange): DatePreset => {
  return PRESET_OPTIONS.find(({ id }) => {
    if (id === 'custom') return false;
    const presetRange = createPresetRange(id);
    return (
      presetRange.since === range.since &&
      presetRange.until === range.until
    );
  })?.id ?? 'custom';
};

const getButtonLabel = (
  loading: boolean,
  progressMessage: string | undefined,
  activityMode: ActivityMode,
  userName: string | null | undefined,
  contributors: readonly string[],
  selectedRepositoryIds: readonly string[],
  repositories: readonly Repository[]
): string => {
  if (loading) {
    return progressMessage || 'Analyzing...';
  }

  const activeRepositoryNames = selectedRepositoryIds.length > 0
    ? selectedRepositoryIds
    : repositories.map(repo => repo.full_name);

  const repoCount = activeRepositoryNames.length;

  if (repoCount === 0) {
    return 'Select repositories to generate';
  }

  switch (activityMode) {
    case 'my-activity': {
      const displayName = userName || 'your activity';
      return `Generate summary for ${displayName} (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
    }
    case 'team-activity': {
      const memberCount = contributors.length;
      if (memberCount === 0) {
        return `Generate team summary (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
      }
      return `Generate summary for ${memberCount} ${memberCount === 1 ? 'member' : 'members'} (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
    }
    case 'my-work-activity': {
      const orgCount = new Set(activeRepositoryNames.map(name => name.split('/')[0])).size;
      const displayName = userName || 'your work';
      return `Generate ${displayName} across ${orgCount} ${orgCount === 1 ? 'org' : 'orgs'} (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
    }
    default:
      return `Generate summary (${repoCount} ${repoCount === 1 ? 'repo' : 'repos'})`;
  }
};

export default function CompactToolbar({
  activityMode,
  onModeChange,
  dateRange,
  onDateRangeChange,
  loading,
  progressMessage,
  repositories,
  selectedRepositoryIds,
  contributors,
  userName,
  onGenerate
}: CompactToolbarProps) {
  const [preset, setPreset] = useState<DatePreset>(() => detectPreset(dateRange));
  const [localRange, setLocalRange] = useState<DateRange>(dateRange);

  useEffect(() => {
    setLocalRange(dateRange);
    setPreset(detectPreset(dateRange));
  }, [dateRange]);

  const handlePresetChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as DatePreset;
    setPreset(value);

    if (value === 'custom') {
      return;
    }

    const newRange = createPresetRange(value);
    setLocalRange(newRange);
    onDateRangeChange(newRange);
  }, [onDateRangeChange]);

  const handleDateChange = useCallback((field: keyof DateRange, value: string) => {
    const nextRange = {
      ...localRange,
      [field]: value
    } as DateRange;

    setLocalRange(nextRange);
    setPreset('custom');
    onDateRangeChange(nextRange);
  }, [localRange, onDateRangeChange]);

  const buttonLabel = useMemo(() => getButtonLabel(
    loading,
    progressMessage,
    activityMode,
    userName,
    contributors,
    selectedRepositoryIds,
    repositories
  ), [
    loading,
    progressMessage,
    activityMode,
    userName,
    contributors,
    selectedRepositoryIds,
    repositories
  ]);

  const disableGenerate = loading || (
    selectedRepositoryIds.length === 0 && repositories.length === 0
  );

  return (
    <div className="sticky top-0 z-40 backdrop-blur bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-2 sm:px-3">
        <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-center gap-2 md:gap-3 py-2">
          <ModeSelector
            selectedMode={activityMode}
            onChange={onModeChange}
            disabled={loading}
            className="bg-white dark:bg-gray-800 w-full md:w-auto"
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-sm w-full md:w-auto">
            <label htmlFor="toolbar-date-preset" className="sr-only">
              Date preset
            </label>
            <select
              id="toolbar-date-preset"
              value={preset}
              onChange={handlePresetChange}
              disabled={loading}
              className="h-10 w-full sm:w-auto sm:min-w-[9rem] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PRESET_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 w-full sm:w-auto">
              <label htmlFor="toolbar-date-since" className="sr-only">
                Start date
              </label>
              <input
                id="toolbar-date-since"
                type="date"
                value={localRange.since}
                onChange={(event) => handleDateChange('since', event.target.value)}
                disabled={loading}
                max={localRange.until}
                className="h-10 flex-1 sm:flex-none sm:w-36 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">→</span>
              <label htmlFor="toolbar-date-until" className="sr-only">
                End date
              </label>
              <input
                id="toolbar-date-until"
                type="date"
                value={localRange.until}
                onChange={(event) => handleDateChange('until', event.target.value)}
                disabled={loading}
                min={localRange.since}
                className="h-10 flex-1 sm:flex-none sm:w-36 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={disableGenerate}
            title={buttonLabel}
            className={`w-full md:w-auto md:ml-auto flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-all shadow-sm ${
              disableGenerate
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md'
            }`}
          >
            {loading && (
              <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span className="whitespace-nowrap">{buttonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
