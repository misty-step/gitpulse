import type { Meta, StoryObj } from '@storybook/react';
import ModeSelector, { ActivityMode, DEFAULT_MODES, ModeOption } from './ModeSelector';

/**
 * ModeSelector stories showcase a radio group component for selecting between 
 * different activity modes (personal, work, team).
 * 
 * Features:
 * - Radio group selection UI
 * - Multiple modes with descriptions
 * - Customizable appearance through theming props
 * - Accessibility support with ARIA attributes
 * - Disabled state support
 * - Keyboard navigation
 */
const meta: Meta<typeof ModeSelector> = {
  title: 'UI/Selectors/Mode Selector',
  component: ModeSelector,
  tags: ['autodocs'],
  argTypes: {
    selectedMode: { 
      description: 'Currently selected mode',
      control: 'radio',
      options: ['my-activity', 'my-work-activity', 'team-activity'],
    },
    onChange: { 
      description: 'Callback fired when mode changes',
      action: 'mode changed' 
    },
    disabled: { 
      description: 'Whether the component is disabled',
      control: 'boolean' 
    },
    modes: { 
      description: 'Available modes to display (defaults to DEFAULT_MODES)',
      control: 'object'
    },
    ariaLabel: { 
      description: 'Accessibility label for the radio group',
      control: 'text' 
    },
    className: {
      description: 'Additional CSS class names',
      control: 'text'
    }
  },
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'dark',
    },
    docs: {
      description: {
        component: 'A radio group component for selecting between different activity modes with customizable appearance and accessibility features.'
      }
    },
    a11y: {
      config: {
        rules: [
          {
            // Ensure proper contrast ratio
            id: 'color-contrast',
            enabled: true
          },
          {
            // Ensure proper ARIA roles
            id: 'aria-valid-attr-value',
            enabled: true
          },
          {
            // Ensure interactive elements are keyboard accessible
            id: 'interactive-supports-focus',
            enabled: true
          }
        ]
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof ModeSelector>;

/**
 * Default state of the ModeSelector with the "my-activity" mode selected.
 * 
 * Keyboard navigation:
 * - Use Tab to focus the component
 * - Use Arrow keys to navigate between options
 * - Use Space or Enter to select an option
 */
export const Default: Story = {
  args: {
    selectedMode: 'my-activity',
    disabled: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Default state with "my-activity" selected. This component supports full keyboard navigation using tab, arrow keys, space, and enter.'
      }
    }
  }
};

/**
 * ModeSelector with "my-work-activity" mode selected.
 */
export const WorkModeSelected: Story = {
  args: {
    selectedMode: 'my-work-activity',
    disabled: false,
  }
};

/**
 * ModeSelector with "team-activity" mode selected.
 */
export const TeamModeSelected: Story = {
  args: {
    selectedMode: 'team-activity',
    disabled: false,
  }
};

/**
 * ModeSelector in disabled state - cannot be interacted with.
 * The component visually indicates its disabled state and is properly
 * marked with aria-disabled attribute.
 */
export const Disabled: Story = {
  args: {
    selectedMode: 'my-activity',
    disabled: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'The disabled state is visually indicated and properly communicated to assistive technologies.'
      }
    }
  }
};

/**
 * ModeSelector with custom modes (different from defaults).
 */
export const CustomModes: Story = {
  args: {
    selectedMode: 'my-activity',
    disabled: false,
    modes: [
      { 
        id: 'my-activity', 
        label: 'VIEW MODE', 
        description: 'View repository information only'
      },
      { 
        id: 'my-work-activity', 
        label: 'EDIT MODE', 
        description: 'Make changes to repositories'
      },
      { 
        id: 'team-activity', 
        label: 'ADMIN MODE', 
        description: 'Full administrative controls'
      },
    ]
  },
  parameters: {
    docs: {
      description: {
        story: 'This example shows how to provide custom modes with different labels and descriptions while maintaining the required ActivityMode types.'
      }
    }
  }
};

/**
 * ModeSelector with custom theme colors.
 * These colors have been selected to maintain proper contrast ratios
 * for accessibility.
 */
export const CustomTheme: Story = {
  args: {
    selectedMode: 'my-activity',
    disabled: false,
    className: 'custom-theme',
  },
  parameters: {
    docs: {
      description: {
        story: 'This example demonstrates how to customize the component\'s appearance with different colors while maintaining accessibility standards.'
      }
    }
  }
};

/**
 * ModeSelector with a custom label and CSS class.
 */
export const CustomLabel: Story = {
  args: {
    selectedMode: 'my-activity',
    disabled: false,
    ariaLabel: 'Select View Mode',
    className: 'shadow-lg'
  },
  parameters: {
    docs: {
      description: {
        story: 'This example shows how to customize the label for better accessibility and add CSS classes for styling.'
      }
    }
  }
};