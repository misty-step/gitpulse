import { useCallback, useEffect, useMemo, useState, ChangeEvent } from 'react';
import { ActivityMode, DateRange, Repository } from '@/types/dashboard';

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

  const handleDateChange = useCallback((field: keyof DateRange, value: string) => {
    const nextRange = {
      ...localRange,
      [field]: value
    } as DateRange;

    setLocalRange(nextRange);
    setPreset('custom');
    onDateRangeChange(nextRange);
  }, [localRange, onDateRangeChange]);

  const disableGenerate = loading || (
    selectedRepositoryIds.length === 0 && repositories.length === 0
  );

  return (
    <header style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      height: '48px',
      position: 'sticky',
      top: 0,
      background: 'white',
      borderBottom: '1px solid var(--border)',
      alignItems: 'center',
      padding: '0 var(--space)',
      gap: 'var(--space)',
      zIndex: 10
    }}>
      {/* Title */}
      <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>GitPulse</h1>

      {/* Date picker */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          id="toolbar-date-since"
          type="date"
          value={localRange.since}
          onChange={(event) => handleDateChange('since', event.target.value)}
          disabled={loading}
          max={localRange.until}
        />
        <span>to</span>
        <input
          id="toolbar-date-until"
          type="date"
          value={localRange.until}
          onChange={(event) => handleDateChange('until', event.target.value)}
          disabled={loading}
          min={localRange.since}
        />
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={disableGenerate}
        style={{
          padding: '6px 16px',
          background: disableGenerate ? '#ccc' : 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: disableGenerate ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 500
        }}
      >
        {loading ? 'Generating...' : 'Generate'}
      </button>
    </header>
  );
}