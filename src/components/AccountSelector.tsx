import { useState, useEffect } from 'react';
import Image from 'next/image';
import { MouseEvent } from 'react';

export type Account = {
  id: number;
  login: string;
  type: string;
  avatarUrl?: string;
};

type AccountSelectorProps = {
  accounts: Account[];
  selectedAccounts: string[];
  onSelectionChange: (selectedAccounts: string[]) => void;
  isLoading?: boolean;
  multiSelect?: boolean;
  showCurrentLabel?: boolean;
  currentUsername?: string;
};

export default function AccountSelector({
  accounts,
  selectedAccounts,
  onSelectionChange,
  isLoading = false,
  multiSelect = true,
  showCurrentLabel = false,
  currentUsername,
}: AccountSelectorProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Toggle selection for an account
  const toggleAccountSelection = (login: string) => {
    // If multiSelect is false, replace selection
    if (!multiSelect) {
      onSelectionChange([login]);
      setShowDropdown(false);
      return;
    }

    // Otherwise toggle in the multiselect
    if (selectedAccounts.includes(login)) {
      onSelectionChange(selectedAccounts.filter(a => a !== login));
    } else {
      onSelectionChange([...selectedAccounts, login]);
    }
  };

  // Select/deselect all accounts
  const selectAll = (select: boolean) => {
    if (select) {
      onSelectionChange(filteredAccounts.map(account => account.login));
    } else {
      onSelectionChange([]);
    }
  };

  // Filter accounts based on search query
  const filteredAccounts = accounts.filter(account => 
    account.login.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.account-selector-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <div className="account-selector-container relative">
      {/* Selected accounts summary button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isLoading || accounts.length === 0}
        className="w-full px-3 py-2 text-sm rounded-md transition-all duration-200 flex items-center justify-between"
        style={{ 
          backgroundColor: 'var(--dark-slate)',
          color: selectedAccounts.length === 0 ? 'var(--electric-blue)' : 'var(--neon-green)',
          border: `1px solid ${selectedAccounts.length === 0 ? 'var(--electric-blue)' : 'var(--neon-green)'}`
        }}
      >
        <div className="flex items-center space-x-2 overflow-hidden">
          {selectedAccounts.length === 0 ? (
            <span className="flex items-center">
              <svg className="h-3 w-3 mr-1 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
              </svg>
              {multiSelect ? 'Select Accounts' : 'Select Account'}
            </span>
          ) : (
            <>
              {selectedAccounts.length > 3 ? (
                <span>{selectedAccounts.length} accounts selected</span>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {selectedAccounts.map((login, index) => (
                    <span key={login} className="flex items-center">
                      {index > 0 && <span>, </span>}
                      <span className="truncate max-w-[100px]">{login}</span>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <svg className={`h-4 w-4 ml-2 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} 
          viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md shadow-lg max-h-96 overflow-hidden flex flex-col"
          style={{ backgroundColor: 'var(--dark-slate)', border: '1px solid var(--neon-green)' }}>
          {/* Search input */}
          <div className="p-2 border-b" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded"
              style={{ 
                backgroundColor: 'rgba(249, 250, 251, 0.8)',
                color: 'var(--foreground)',
                border: '1px solid var(--electric-blue)'
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Multi-select controls */}
          {multiSelect && accounts.length > 1 && (
            <div className="flex justify-between p-2 border-b text-xs" 
              style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectAll(true);
                }}
                className="px-2 py-1 rounded"
                style={{ 
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--neon-green)'
                }}
              >
                SELECT ALL
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectAll(false);
                }}
                className="px-2 py-1 rounded"
                style={{ 
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--electric-blue)'
                }}
              >
                CLEAR ALL
              </button>
            </div>
          )}

          {/* Account list */}
          <div className="overflow-y-auto max-h-64">
            {filteredAccounts.length > 0 ? (
              <div className="py-1">
                {filteredAccounts.map(account => (
                  <div 
                    key={account.id}
                    onClick={() => toggleAccountSelection(account.login)}
                    className="flex items-center px-3 py-2 hover:opacity-80 cursor-pointer"
                    style={{ 
                      backgroundColor: selectedAccounts.includes(account.login) 
                        ? 'rgba(16, 185, 129, 0.1)' 
                        : 'transparent',
                      color: 'var(--foreground)'
                    }}
                  >
                    <div className="flex-shrink-0 mr-3">
                      {account.avatarUrl ? (
                        <div className="relative w-6 h-6 rounded-full overflow-hidden">
                          <Image
                            src={account.avatarUrl}
                            alt={account.login}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: 'var(--electric-blue)' }}>
                          {account.login.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-grow">
                      <div className="text-sm font-medium flex items-center">
                        {account.login}
                        {currentUsername && account.login === currentUsername && showCurrentLabel && (
                          <span className="ml-2 text-xs px-1 rounded" style={{ 
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            color: 'var(--neon-green)'
                          }}>
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--electric-blue)' }}>
                        {account.type}
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 ml-2">
                      <input
                        type={multiSelect ? "checkbox" : "radio"}
                        name="account-selection"
                        checked={selectedAccounts.includes(account.login)}
                        onChange={() => {}} // Handled by the parent div click
                        onClick={(e) => e.stopPropagation()} // Prevent double-triggering
                        className="form-checkbox h-4 w-4"
                        style={{ accentColor: 'var(--neon-green)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-3 px-3 text-center" style={{ color: 'var(--foreground)' }}>
                No accounts match your search
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}