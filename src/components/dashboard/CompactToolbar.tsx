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
    <div>
      <div>
        <div>
          <ModeSelector
            selectedMode={activityMode}
            onChange={onModeChange}
            disabled={loading}
           
          />

          <div>
            <label htmlFor="toolbar-date-preset">
              Date preset
            </label>
            <select
              id="toolbar-date-preset"
              value={preset}
              onChange={handlePresetChange}
              disabled={loading}>
              {PRESET_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>

            <div>
              <label htmlFor="toolbar-date-since">
                Start date
              </label>
              <input
                id="toolbar-date-since"
                type="date"
                value={localRange.since}
                onChange={(event) => handleDateChange('since', event.target.value)}
                disabled={loading}
                max={localRange.until}
               
              />
              <span>→</span>
              <label htmlFor="toolbar-date-until">
                End date
              </label>
              <input
                id="toolbar-date-until"
                type="date"
                value={localRange.until}
                onChange={(event) => handleDateChange('until', event.target.value)}
                disabled={loading}
                min={localRange.since}
               
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onGenerate}
            disabled={disableGenerate}
            title={buttonLabel}
          >
            {loading && (
              <span />
            )}
            <span>{buttonLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
