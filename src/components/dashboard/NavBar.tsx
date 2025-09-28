import { useState } from 'react';
import { DateRange, Repository } from '@/types/dashboard';

export interface NavBarProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  loading: boolean;
  repositories: readonly Repository[];
  onGenerate: () => void;
  lastGeneration?: {
    timestamp: number;
    repoCount: number;
  } | null;
  onRegenerateLast?: () => void;
}

export default function NavBar({
  dateRange,
  onDateRangeChange,
  loading,
  repositories,
  onGenerate,
  lastGeneration,
  onRegenerateLast
}: NavBarProps) {
  const [localRange, setLocalRange] = useState<DateRange>(dateRange);

  const handleDateChange = (field: keyof DateRange, value: string) => {
    const nextRange = { ...localRange, [field]: value };
    setLocalRange(nextRange);
    onDateRangeChange(nextRange);
  };

  const disableGenerate = loading || repositories.length === 0;

  // Format time since last generation
  const getTimeSince = () => {
    if (!lastGeneration) return null;
    const minutes = Math.floor((Date.now() - lastGeneration.timestamp) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  return (
    <nav style={{
      display: 'grid',
      gridTemplateColumns: lastGeneration ? '1fr auto auto auto' : '1fr auto auto',
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
      <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
        GitPulse
      </h1>

      {/* Date range inputs */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          type="date"
          value={localRange.since}
          onChange={(e) => handleDateChange('since', e.target.value)}
          disabled={loading}
          max={localRange.until}
        />
        <span>to</span>
        <input
          type="date"
          value={localRange.until}
          onChange={(e) => handleDateChange('until', e.target.value)}
          disabled={loading}
          min={localRange.since}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      {/* Quick regenerate (if available) */}
      {lastGeneration && onRegenerateLast && (
        <button
          type="button"
          onClick={onRegenerateLast}
          disabled={loading}
          title={`Regenerate ${lastGeneration.repoCount} repos from ${getTimeSince()}`}
          style={{ fontSize: '14px' }}
        >
          ↻ Last
        </button>
      )}

      {/* Generate button */}
      <button
        type="button"
        className="generate-button"
        onClick={onGenerate}
        disabled={disableGenerate}
        style={{ padding: '6px 16px', borderRadius: '4px', fontSize: '14px' }}
      >
        {loading ? 'Generating...' : 'Generate'}
      </button>
    </nav>
  );
}