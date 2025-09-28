import { useState, useCallback, useMemo, useEffect } from 'react';

export type DateRange = {
  since: string; // YYYY-MM-DD format
  until: string; // YYYY-MM-DD format
};

export interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (newDateRange: DateRange) => void;
  disabled?: boolean;
}

// Format date to YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export default function DateRangePicker({
  dateRange,
  onChange,
  disabled = false
}: DateRangePickerProps) {
  // Calculate today's date for max value
  const today = useMemo(() => formatDate(new Date()), []);

  // Calculate common preset date ranges
  const presets = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Last 7 days
    const last7Days = new Date(now);
    last7Days.setDate(now.getDate() - 7);

    // Last 30 days
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    // First day of current month
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // First day of previous month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Last day of previous month
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    return [
      { id: 'last7', label: 'Last 7 days', since: formatDate(last7Days), until: formatDate(now) },
      { id: 'last30', label: 'Last 30 days', since: formatDate(last30Days), until: formatDate(now) },
      { id: 'thisMonth', label: 'This month', since: formatDate(thisMonth), until: formatDate(now) },
      { id: 'lastMonth', label: 'Last month', since: formatDate(lastMonthStart), until: formatDate(lastMonthEnd) }
    ];
  }, []);

  // Apply preset date range
  const applyPreset = useCallback((preset: typeof presets[0]) => {
    if (!disabled) {
      onChange({ since: preset.since, until: preset.until });
    }
  }, [disabled, onChange]);

  // Handle manual date changes
  const handleDateChange = useCallback((field: keyof DateRange, value: string) => {
    if (!disabled) {
      onChange({
        ...dateRange,
        [field]: value
      });
    }
  }, [dateRange, disabled, onChange]);

  // Check if a preset is currently active
  const isPresetActive = useCallback((preset: typeof presets[0]): boolean => {
    return dateRange.since === preset.since && dateRange.until === preset.until;
  }, [dateRange]);

  return (
    <fieldset style={{
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: 'var(--space)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space)'
    }} disabled={disabled}>
      <legend style={{ fontWeight: '500' }}>Date Range</legend>

      {/* Compact preset buttons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'calc(var(--space) / 2)'
      }}>
        {presets.map(preset => (
          <button
            key={preset.id}
            type="button"
            onClick={() => applyPreset(preset)}
            disabled={disabled}
            style={{
              padding: 'calc(var(--space) / 2)',
              fontSize: '0.75rem',
              borderRadius: '4px',
              border: isPresetActive(preset) ? 'none' : '1px solid var(--border)',
              background: isPresetActive(preset) ? 'var(--accent)' : 'white',
              color: isPresetActive(preset) ? 'white' : 'var(--text)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.2s'
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Native date inputs side-by-side */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        gap: 'calc(var(--space) / 2)',
        alignItems: 'end'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) / 4)' }}>
          <label htmlFor="date-since" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            From
          </label>
          <input
            type="date"
            id="date-since"
            value={dateRange.since}
            onChange={(e) => handleDateChange('since', e.target.value)}
            disabled={disabled}
            max={dateRange.until}
            required
          />
        </div>

        <span style={{ paddingBottom: 'calc(var(--space) / 2)', color: 'var(--muted)' }}>to</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(var(--space) / 4)' }}>
          <label htmlFor="date-until" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            To
          </label>
          <input
            type="date"
            id="date-until"
            value={dateRange.until}
            onChange={(e) => handleDateChange('until', e.target.value)}
            disabled={disabled}
            min={dateRange.since}
            max={today}
            required
          />
        </div>
      </div>
    </fieldset>
  );
}