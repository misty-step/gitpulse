import { ActivityMode } from '@/types/dashboard';

/**
 * Configuration for a mode option
 */
export interface ModeOption {
  id: ActivityMode;
  label: string;
  description: string;
}

/**
 * Default mode options available in the application
 */
export const DEFAULT_MODES: ModeOption[] = [
  {
    id: 'my-activity',
    label: 'My Activity',
    description: 'View your commits across all repositories'
  },
  {
    id: 'my-work-activity',
    label: 'My Work',
    description: 'View your commits within selected organizations'
  },
  {
    id: 'team-activity',
    label: 'Team',
    description: 'View all team members\' activity within selected organizations'
  },
];

/**
 * Props for the ModeSelector component
 */
export interface ModeSelectorProps {
  selectedMode: ActivityMode;
  onChange: (mode: ActivityMode) => void;
  disabled?: boolean;
  modes?: ModeOption[];
  name?: string;
}

/**
 * ModeSelector component - Native HTML fieldset with radio buttons
 * Accessible by default, works without JS for form submission
 */
export default function ModeSelector({
  selectedMode,
  onChange,
  disabled = false,
  modes = DEFAULT_MODES,
  name = 'activity-mode'
}: ModeSelectorProps) {
  return (
    <fieldset
      disabled={disabled}
      style={{
        border: '1px solid var(--border)',
        borderRadius: '4px',
        padding: 'calc(var(--space) / 2) var(--space)'
      }}
    >
      <legend style={{ fontSize: '14px', fontWeight: 500 }}>Activity Mode</legend>
      {modes.map(mode => (
        <label
          key={mode.id}
          style={{
            display: 'block',
            marginBottom: 'calc(var(--space) / 2)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1
          }}
        >
          <input
            type="radio"
            name={name}
            value={mode.id}
            checked={selectedMode === mode.id}
            onChange={() => onChange(mode.id)}
            disabled={disabled}
            style={{ marginRight: 'calc(var(--space) / 2)' }}
          />
          <span>{mode.label}</span>
          {' - '}
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
            {mode.description}
          </span>
        </label>
      ))}
    </fieldset>
  );
}