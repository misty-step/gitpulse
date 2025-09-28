import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { ActivityMode } from '@/types/dashboard';
import { useDebounceCallback } from '@/hooks/useDebounce';

export type Organization = {
  id: number;
  login: string;
  type: string;
  avatarUrl?: string;
};

export interface OrganizationPickerProps {
  organizations: Organization[];
  selectedOrganizations: string[];
  onSelectionChange: (selectedOrgs: string[]) => void;
  mode: ActivityMode;
  disabled?: boolean;
  isLoading?: boolean;
  currentUsername?: string;
}

// Debounce delay for organization selection changes (in milliseconds)
const ORG_DEBOUNCE_DELAY = 500;

export default function OrganizationPicker({
  organizations,
  selectedOrganizations,
  onSelectionChange,
  mode,
  disabled = false,
  isLoading = false,
  currentUsername
}: OrganizationPickerProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasBeenOpened, setHasBeenOpened] = useState(false);
  // Internal state for immediate UI feedback
  const [internalSelection, setInternalSelection] = useState<string[]>(selectedOrganizations);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Support multi-select only for team-activity mode
  const multiSelect = mode === 'team-activity';

  // Update internal state when props change
  useEffect(() => {
    setInternalSelection(selectedOrganizations);
  }, [selectedOrganizations]);

  // Create debounced selection change handler (500ms delay)
  const { callback: debouncedOnSelectionChange, pending: isDebouncing } = useDebounceCallback(
    onSelectionChange,
    ORG_DEBOUNCE_DELAY
  );

  // Filter organizations based on search query
  const filteredOrganizations = organizations.filter(org => 
    org.login.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle selection for an organization
  const toggleSelection = useCallback((login: string) => {
    if (disabled || isLoading) return;

    // If multiSelect is false, replace selection
    if (!multiSelect) {
      const newSelection = [login];
      setInternalSelection(newSelection);
      debouncedOnSelectionChange(newSelection);
      setShowDropdown(false);
      return;
    }

    // Otherwise toggle in the multiselect
    if (internalSelection.includes(login)) {
      const newSelection = internalSelection.filter(o => o !== login);
      setInternalSelection(newSelection);
      debouncedOnSelectionChange(newSelection);
    } else {
      const newSelection = [...internalSelection, login];
      setInternalSelection(newSelection);
      debouncedOnSelectionChange(newSelection);
    }
  }, [disabled, isLoading, multiSelect, debouncedOnSelectionChange, internalSelection]);

  // Select/deselect all organizations
  const selectAll = useCallback((select: boolean) => {
    if (disabled || isLoading) return;
    
    if (select) {
      const newSelection = filteredOrganizations.map(org => org.login);
      setInternalSelection(newSelection);
      debouncedOnSelectionChange(newSelection);
    } else {
      setInternalSelection([]);
      debouncedOnSelectionChange([]);
    }
  }, [disabled, isLoading, filteredOrganizations, debouncedOnSelectionChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Toggle dropdown
  const handleDropdownToggle = useCallback(() => {
    if (disabled || isLoading) return;
    
    if (!showDropdown && !hasBeenOpened) {
      setHasBeenOpened(true);
    }
    
    setShowDropdown(prev => !prev);
  }, [disabled, isLoading, showDropdown, hasBeenOpened]);

  // Check if the component should be visible based on mode
  const shouldDisplay = mode === 'my-work-activity' || mode === 'team-activity';
  if (!shouldDisplay) return null;

  // Combined loading state (API loading or debouncing)
  const isProcessing = isLoading || isDebouncing;

  return (
    <div 
      className="rounded-lg border" 
      style={{ 
        backgroundColor: 'rgba(249, 250, 251, 0.95)',
        backdropFilter: 'blur(5px)',
        borderColor: isDebouncing ? 'var(--neon-green)' : 'var(--electric-blue)',
        transition: 'border-color 0.2s'
      }}
      ref={dropdownRef}
    >
      <div className="p-3 border-b" style={{ borderColor: isDebouncing ? 'var(--neon-green)' : 'var(--electric-blue)', transition: 'border-color 0.2s' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div 
              className="w-2 h-2 rounded-full mr-2" 
              style={{ 
                backgroundColor: isDebouncing ? 'var(--neon-green)' : 'var(--electric-blue)',
                transition: 'background-color 0.2s'
              }}
            ></div>
            <h3 className="text-sm uppercase" style={{ color: isDebouncing ? 'var(--neon-green)' : 'var(--electric-blue)', transition: 'color 0.2s' }}>
              {multiSelect ? 'ORGANIZATIONS' : 'ORGANIZATION'}
            </h3>
          </div>
          
          {/* Debounce indicator */}
          {isDebouncing && (
            <div className="flex items-center">
              <span 
                className="inline-block w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-1" 
                style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}
              ></span>
              <span className="text-xs" style={{ color: 'var(--neon-green)' }}>UPDATING</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-1.5">
        <div className="text-xs mb-2" style={{ color: 'var(--electric-blue)' }}>
          {multiSelect ? 'SELECT ORGANIZATIONS' : 'SELECT ORGANIZATION'}
        </div>
        
        {/* Selection button */}
        <button
          type="button"
          onClick={handleDropdownToggle}
          disabled={disabled || isProcessing || organizations.length === 0}
          className="w-full px-3 py-2 text-sm rounded-md transition-all duration-200 flex items-center justify-between border"
          style={{ 
            backgroundColor: 'var(--dark-slate)',
            color: internalSelection.length === 0 ? 'var(--electric-blue)' : 'var(--neon-green)',
            borderColor: internalSelection.length === 0 ? 'var(--electric-blue)' : 'var(--neon-green)',
            opacity: (disabled || isProcessing) ? 0.6 : 1,
            cursor: (disabled || isProcessing) ? 'not-allowed' : 'pointer'
          }}
        >
          <div className="flex items-center space-x-2 overflow-hidden">
            {internalSelection.length === 0 ? (
              <span className="flex items-center">
                <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                {multiSelect ? 'Select organizations' : 'Select organization'}
              </span>
            ) : (
              <>
                {internalSelection.length > 2 ? (
                  <span>{internalSelection.length} organizations selected</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {internalSelection.map((login, index) => (
                      <span key={login} className="flex items-center">
                        {index > 0 && <span>, </span>}
                        <span className="truncate max-w-[120px]">{login}</span>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <svg 
            className={`h-4 w-4 ml-2 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="mt-2 flex items-center text-xs" style={{ color: 'var(--electric-blue)' }}>
            <span className="inline-block w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2" 
              style={{ borderColor: 'var(--electric-blue)', borderTopColor: 'transparent' }}></span>
            <span>Loading organizations...</span>
          </div>
        )}
        
        {/* No organizations message */}
        {!isLoading && organizations.length === 0 && (
          <div className="mt-2 text-xs" style={{ color: 'var(--foreground)' }}>
            No organizations available. Install the GitHub App to access more accounts.
          </div>
        )}
        
        {/* Dropdown menu */}
        {showDropdown && organizations.length > 0 && (
          <div 
            className="mt-2 rounded-md shadow-lg max-h-96 overflow-hidden flex flex-col border"
            style={{ backgroundColor: 'var(--dark-slate)', borderColor: 'var(--neon-green)' }}
          >
            {/* Search input */}
            <div className="p-2 border-b" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2 py-1 text-sm rounded"
                style={{ 
                  backgroundColor: 'rgba(249, 250, 251, 0.8)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--electric-blue)'
                }}
              />
            </div>
            
            {/* Multi-select controls */}
            {multiSelect && organizations.length > 1 && (
              <div 
                className="flex justify-between p-2 border-b text-xs" 
                style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}
              >
                <button
                  onClick={() => selectAll(true)}
                  disabled={isDebouncing}
                  className="px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: 'var(--neon-green)',
                    opacity: isDebouncing ? 0.6 : 1,
                    cursor: isDebouncing ? 'not-allowed' : 'pointer'
                  }}
                >
                  SELECT ALL
                </button>
                <button
                  onClick={() => selectAll(false)}
                  disabled={isDebouncing}
                  className="px-2 py-1 rounded"
                  style={{ 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--electric-blue)',
                    opacity: isDebouncing ? 0.6 : 1,
                    cursor: isDebouncing ? 'not-allowed' : 'pointer'
                  }}
                >
                  CLEAR ALL
                </button>
              </div>
            )}
            
            {/* Organization list */}
            <div className="overflow-y-auto max-h-64">
              {filteredOrganizations.length > 0 ? (
                <div className="py-1">
                  {filteredOrganizations.map(org => (
                    <div 
                      key={org.id}
                      onClick={() => toggleSelection(org.login)}
                      className="flex items-center px-3 py-2 hover:opacity-80 cursor-pointer"
                      style={{ 
                        backgroundColor: internalSelection.includes(org.login) 
                          ? 'rgba(16, 185, 129, 0.1)' 
                          : 'transparent',
                        color: 'var(--foreground)',
                        opacity: isDebouncing ? 0.7 : 1,
                        cursor: isDebouncing ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <div className="flex-shrink-0 mr-3">
                        {org.avatarUrl ? (
                          <div className="relative w-6 h-6 rounded-full overflow-hidden">
                            <Image
                              src={org.avatarUrl}
                              alt={org.login}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          </div>
                        ) : (
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: 'var(--electric-blue)' }}
                          >
                            {org.login.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-grow">
                        <div className="text-sm font-medium flex items-center">
                          {org.login}
                          {currentUsername && org.login === currentUsername && (
                            <span 
                              className="ml-2 text-xs px-1 rounded" 
                              style={{ 
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                color: 'var(--neon-green)'
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--electric-blue)' }}>
                          {org.type}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0 ml-2">
                        <input
                          type={multiSelect ? "checkbox" : "radio"}
                          name="organization-selection"
                          checked={internalSelection.includes(org.login)}
                          onChange={() => {}} // Handled by the parent div click
                          onClick={(e) => e.stopPropagation()} // Prevent double-triggering
                          className="h-4 w-4"
                          style={{ accentColor: 'var(--neon-green)' }}
                          disabled={isDebouncing}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-3 px-3 text-center" style={{ color: 'var(--foreground)' }}>
                  No organizations match your search
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}