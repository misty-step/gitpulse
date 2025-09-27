import { useId } from 'react';

/**
 * Activity mode options for data display filtering
 */
export type ActivityMode = 'my-activity' | 'my-work-activity' | 'team-activity';

/**
 * Configuration for a mode option
 */
export interface ModeOption {
  /**
   * Unique identifier for the mode
   */
  id: ActivityMode;
  
  /**
   * Display label for the mode
   */
  label: string;
  
  /**
   * Descriptive text explaining the mode
   */
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
  /**
   * Currently selected mode
   */
  selectedMode: ActivityMode;
  
  /**
   * Callback fired when mode changes
   * @param mode The newly selected mode
   */
  onChange: (mode: ActivityMode) => void;
  
  /**
   * Whether the component is disabled
   * @default false
   */
  disabled?: boolean;
  
  /**
   * Available modes to display
   * @default DEFAULT_MODES
   */
  modes?: ModeOption[];
  
  /**
   * Accessibility label for the radio group
   * @default 'Activity Mode'
   */
  ariaLabel?: string;
  
  /**
   * CSS class to apply to the root element
   */
  className?: string;
}

/**
 * ModeSelector component displays a radio group to select between different 
 * activity modes (personal, work, team).
 * 
 * Accessibility features:
 * - Uses proper radiogroup and radio roles
 * - Supports keyboard navigation with tab, space, and enter
 * - Uses stable, unique IDs for ARIA attributes
 * - Provides descriptive labels for all interactive elements
 * 
 * @example
 * ```tsx
 * <ModeSelector 
 *   selectedMode="my-activity" 
 *   onChange={handleModeChange} 
 * />
 * ```
 */
export default function ModeSelector({
  selectedMode,
  onChange,
  disabled = false,
  modes = DEFAULT_MODES,
  ariaLabel = 'Activity Mode',
  className = '',
}: ModeSelectorProps) {
  // Use stable IDs
  const headerId = useId();
  const groupId = useId();
  
  // Handle mode change
  const handleModeChange = (mode: ActivityMode) => {
    if (!disabled) {
      onChange(mode);
    }
  };

  // Handle keyboard navigation between radio options
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (disabled) return;
    
    // Get all selectable mode IDs
    const modeIds = modes.map(m => m.id);
    
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % modes.length;
      onChange(modeIds[nextIndex]);
      // Focus the next element
      const nextElement = document.getElementById(`${groupId}-option-${nextIndex}`);
      nextElement?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + modes.length) % modes.length;
      onChange(modeIds[prevIndex]);
      // Focus the previous element
      const prevElement = document.getElementById(`${groupId}-option-${prevIndex}`);
      prevElement?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(modeIds[currentIndex]);
    }
  };

  return (
    <div
      className={`inline-flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}
      role="radiogroup"
      aria-labelledby={headerId}
      aria-disabled={disabled}
    >
      <span id={headerId} className="sr-only">{ariaLabel}</span>

      {modes.map((mode, index) => {
        const isSelected = selectedMode === mode.id;
        const optionId = `${groupId}-option-${index}`;

        return (
          <button
            id={optionId}
            key={mode.id}
            className={`
              px-4 py-1.5 rounded-md text-sm font-medium transition-colors
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${isSelected
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
            `}
            onClick={() => handleModeChange(mode.id)}
            role="radio"
            aria-checked={isSelected}
            aria-label={mode.label}
            aria-describedby={`${optionId}-description`}
            tabIndex={disabled ? -1 : (isSelected ? 0 : -1)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            data-testid={`mode-option-${mode.id}`}
            disabled={disabled}
            title={mode.description}
          >
            <span id={`${optionId}-label`}>
              {mode.label}
            </span>
            <span id={`${optionId}-description`} className="sr-only">
              {mode.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}