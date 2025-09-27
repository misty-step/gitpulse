import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDebounceCallback } from '@/hooks/useDebounce';

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

// Debounce delay for date changes (in milliseconds)
const DATE_DEBOUNCE_DELAY = 300;

export default function DateRangePicker({
  dateRange,
  onChange,
  disabled = false
}: DateRangePickerProps) {
  // Internal state for immediate UI feedback
  const [internalDateRange, setInternalDateRange] = useState<DateRange>(dateRange);
  
  // Update internal state when props change
  useEffect(() => {
    setInternalDateRange(dateRange);
  }, [dateRange]);
  
  // Create debounced onChange handler (300ms delay)
  const { callback: debouncedOnChange, pending: isDebouncing } = useDebounceCallback(
    onChange,
    DATE_DEBOUNCE_DELAY
  );
  
  // Calculate common preset date ranges
  const presets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Last 7 days
    const last7Days = new Date(today);
    last7Days.setDate(today.getDate() - 7);
    
    // Last 30 days
    const last30Days = new Date(today);
    last30Days.setDate(today.getDate() - 30);
    
    // First day of current month
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // First day of previous month
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    // Last day of previous month
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
    
    return {
      last7Days: {
        since: formatDate(last7Days),
        until: formatDate(today)
      },
      last30Days: {
        since: formatDate(last30Days),
        until: formatDate(today)
      },
      thisMonth: {
        since: formatDate(thisMonth),
        until: formatDate(today)
      },
      lastMonth: {
        since: formatDate(lastMonthStart),
        until: formatDate(lastMonthEnd)
      }
    };
  }, []);
  
  // Apply preset date range
  const applyPreset = useCallback((preset: keyof typeof presets) => {
    if (!disabled) {
      const newRange = presets[preset];
      // Update internal state immediately
      setInternalDateRange(newRange);
      // Trigger the debounced change
      debouncedOnChange(newRange);
    }
  }, [disabled, presets, debouncedOnChange]);
  
  // Handle manual date changes
  const handleDateChange = useCallback((field: keyof DateRange, value: string) => {
    if (!disabled) {
      const newRange = {
        ...internalDateRange,
        [field]: value
      };
      // Update internal state immediately
      setInternalDateRange(newRange);
      // Trigger the debounced change
      debouncedOnChange(newRange);
    }
  }, [internalDateRange, disabled, debouncedOnChange]);
  
  // Check if a preset is currently active
  const isPresetActive = useCallback((preset: DateRange): boolean => {
    return internalDateRange.since === preset.since && internalDateRange.until === preset.until;
  }, [internalDateRange]);

  return (
    <div className="space-y-2">
      {/* Compact preset buttons */}
      <div className="flex flex-wrap gap-1">
        <div className="grid grid-cols-4 gap-1 w-full">
          {[
            { id: 'last7Days', label: 'Last 7 days' },
            { id: 'last30Days', label: 'Last 30 days' },
            { id: 'thisMonth', label: 'This month' },
            { id: 'lastMonth', label: 'Last month' }
          ].map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id as keyof typeof presets)}
              disabled={disabled || isDebouncing}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                isPresetActive(presets[preset.id as keyof typeof presets])
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              } ${(disabled || isDebouncing) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {/* Date inputs side-by-side */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            htmlFor="since"
            className="block text-xs mb-1 text-gray-600 dark:text-gray-400"
          >
            From
          </label>
          <input
            type="date"
            id="since"
            value={internalDateRange.since}
            onChange={(e) => handleDateChange('since', e.target.value)}
            disabled={disabled}
            className="block w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            max={internalDateRange.until}
          />
        </div>

        <div>
          <label
            htmlFor="until"
            className="block text-xs mb-1 text-gray-600 dark:text-gray-400"
          >
            To
          </label>
          <input
            type="date"
            id="until"
            value={internalDateRange.until}
            onChange={(e) => handleDateChange('until', e.target.value)}
            disabled={disabled}
            className="block w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
            min={internalDateRange.since}
          />
        </div>
      </div>

      {/* Loading indicator */}
      {isDebouncing && (
        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-1"></span>
          Updating...
        </div>
      )}
    </div>
  );
}