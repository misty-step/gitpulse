import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import AccountSelector, { Account } from './AccountSelector';

type Contributor = {
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  commitCount?: number;
};

type Installation = {
  id: number;
  account: {
    login: string;
    type: string;
    avatarUrl?: string;
  };
};

type FilterPanelProps = {
  onFilterChange: (filters: FilterState) => void;
  isLoading: boolean;
  installations: Installation[];
  currentUsername?: string;
};

export type FilterState = {
  contributors: string[];
  organizations: string[];
  repositories: string[];
  groupBy: 'contributor' | 'organization' | 'repository' | 'chronological';
  generateGroupSummaries: boolean;
};

export default function FilterPanel({ 
  onFilterChange, 
  isLoading, 
  installations,
  currentUsername
}: FilterPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(false);

  // Filter state
  const [selectedContributors, setSelectedContributors] = useState<string[]>([]);
  const [selectOnlyMe, setSelectOnlyMe] = useState(false);
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'contributor' | 'organization' | 'repository' | 'chronological'>('chronological');
  const [generateGroupSummaries, setGenerateGroupSummaries] = useState(false);

  // Fetch contributors from the API - wrapped in useCallback to avoid dependency issues
  const fetchContributors = useCallback(async () => {
    try {
      setLoadingContributors(true);
      // Convert installations to organization list
      const orgList = installations.map(inst => inst.account.login).join(',');
      
      // The API now handles adding a date range if none is provided
      const response = await fetch(`/api/contributors?organizations=${orgList}&include_commit_count=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch contributors');
      }
      
      const data = await response.json();
      setContributors(data.contributors || []);

      // Fetching is now managed per session
    } catch (error) {
      console.error('Error fetching contributors:', error);
    } finally {
      setLoadingContributors(false);
    }
  }, [installations, setContributors, setLoadingContributors]);
  
  
  // Fetch contributors when the component loads
  useEffect(() => {
    if (expanded && !loadingContributors && contributors.length === 0) {
      fetchContributors();
    }
  }, [expanded, contributors.length, loadingContributors, fetchContributors]);

  // Apply filters when any filter changes
  useEffect(() => {
    const newFilters: FilterState = {
      contributors: selectOnlyMe ? ['me'] : selectedContributors,
      organizations: selectedOrganizations,
      repositories: selectedRepositories,
      groupBy,
      generateGroupSummaries
    };
    
    onFilterChange(newFilters);
  }, [
    selectedContributors,
    selectOnlyMe,
    selectedOrganizations,
    selectedRepositories,
    groupBy,
    generateGroupSummaries,
    onFilterChange
  ]);

  // Handle "Only Me" checkbox
  const handleOnlyMeChange = (checked: boolean) => {
    setSelectOnlyMe(checked);
    if (checked) {
      // Clear other contributor selections when "Only Me" is selected
      setSelectedContributors([]);
    }
  };

  // Handle contributor selection
  const handleContributorChange = (contributorUsername: string, checked: boolean) => {
    if (checked) {
      setSelectedContributors(prev => [...prev, contributorUsername]);
      // Uncheck "Only Me" if a specific contributor is selected
      if (selectOnlyMe) {
        setSelectOnlyMe(false);
      }
    } else {
      setSelectedContributors(prev => prev.filter(c => c !== contributorUsername));
    }
  };

  // Handle organization selection
  const handleOrganizationChange = (orgName: string, checked: boolean) => {
    if (checked) {
      setSelectedOrganizations(prev => [...prev, orgName]);
    } else {
      setSelectedOrganizations(prev => prev.filter(o => o !== orgName));
    }
  };

  // Reset all filters
  const handleReset = () => {
    setSelectedContributors([]);
    setSelectOnlyMe(false);
    setSelectedOrganizations([]);
    setSelectedRepositories([]);
    setGroupBy('chronological');
    setGenerateGroupSummaries(false);
  };

  return (
    <div className="border rounded-lg p-3 mb-6" style={{ 
      backgroundColor: 'rgba(249, 250, 251, 0.95)',
      backdropFilter: 'blur(5px)',
      borderColor: 'var(--electric-blue)',
      boxShadow: '0 0 15px rgba(59, 130, 246, 0.15)'
    }}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: 'var(--electric-blue)' }}></div>
          <h3 className="text-sm uppercase" style={{ color: 'var(--electric-blue)' }}>
            ANALYSIS FILTERS
          </h3>
        </div>
        <div className="flex items-center">
          {/* Show indicators for active filters */}
          {(selectedContributors.length > 0 || selectOnlyMe || selectedOrganizations.length > 0 || selectedRepositories.length > 0 || groupBy !== 'chronological') && (
            <div className="px-2 py-1 text-xs rounded mr-2" style={{ 
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--neon-green)'
            }}>
              FILTERS ACTIVE
            </div>
          )}
          
          <svg 
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
            style={{ color: 'var(--electric-blue)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Expandable filter panel */}
      {expanded && (
        <div className="mt-4 space-y-6">
          {/* Contributors filter */}
          <div>
            <h4 className="text-xs mb-2 font-bold" style={{ color: 'var(--electric-blue)' }}>CONTRIBUTOR FILTER</h4>
            <div className="space-y-2">
              {/* "Only My Commits" checkbox */}
              <div className="flex items-center">
                <input 
                  type="checkbox" 
                  id="only-me" 
                  checked={selectOnlyMe}
                  onChange={(e) => handleOnlyMeChange(e.target.checked)}
                  disabled={isLoading}
                  className="mr-2"
                  style={{ 
                    accentColor: 'var(--neon-green)'
                  }}
                />
                <label 
                  htmlFor="only-me" 
                  className="text-sm"
                  style={{ color: 'var(--foreground)' }}
                >
                  ONLY MY COMMITS ({currentUsername || 'current user'})
                </label>
              </div>
              
              {/* Contributor selection (hidden when "Only Me" is selected) */}
              {!selectOnlyMe && (
                <div className="pl-5 pt-2">
                  <div className="text-xs mb-2" style={{ color: 'var(--electric-blue)' }}>
                    SELECT SPECIFIC CONTRIBUTORS:
                  </div>
                  
                  {loadingContributors ? (
                    <div className="flex items-center text-xs" style={{ color: 'var(--foreground)' }}>
                      <span className="inline-block w-3 h-3 border-2 border-t-transparent rounded-full animate-spin mr-2" 
                        style={{ borderColor: 'var(--neon-green)', borderTopColor: 'transparent' }}></span>
                      <span>Loading contributors...</span>
                    </div>
                  ) : contributors.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto pr-2">
                      {contributors.map(contributor => (
                        <div key={contributor.username} className="flex items-center mb-2">
                          <input 
                            type="checkbox" 
                            id={`contributor-${contributor.username}`}
                            checked={selectedContributors.includes(contributor.username)}
                            onChange={(e) => handleContributorChange(contributor.username, e.target.checked)}
                            disabled={isLoading}
                            className="mr-2"
                            style={{ 
                              accentColor: 'var(--neon-green)'
                            }}
                          />
                          <label 
                            htmlFor={`contributor-${contributor.username}`} 
                            className="text-sm flex items-center"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {contributor.avatarUrl && (
                              <Image 
                                src={contributor.avatarUrl} 
                                alt={contributor.displayName}
                                width={20}
                                height={20}
                                className="w-5 h-5 rounded-full mr-2"
                              />
                            )}
                            <span>{contributor.displayName}</span>
                            {contributor.commitCount && (
                              <span className="ml-2 text-xs px-1 rounded" style={{ 
                                backgroundColor: 'rgba(249, 250, 251, 0.8)',
                                color: 'var(--electric-blue)'
                              }}>
                                {contributor.commitCount}
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--foreground)' }}>
                      No contributors found. Try expanding the date range.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Organizations filter */}
          <div>
            <h4 className="text-xs mb-2 font-bold" style={{ color: 'var(--electric-blue)' }}>ACCOUNT/ORGANIZATION FILTER</h4>
            <div className="space-y-2">
              {installations.length > 0 ? (
                <>
                  <AccountSelector
                    accounts={installations.map(installation => ({
                      id: installation.id,
                      login: installation.account.login,
                      type: installation.account.type,
                      avatarUrl: installation.account.avatarUrl
                    }))}
                    selectedAccounts={selectedOrganizations}
                    onSelectionChange={setSelectedOrganizations}
                    isLoading={isLoading}
                    multiSelect={true}
                    showCurrentLabel={true}
                    currentUsername={currentUsername}
                  />
                  
                  {/* Note about selection */}
                  <div className="text-xs italic" style={{ color: 'var(--foreground)' }}>
                    {selectedOrganizations.length === 0 ? 
                      "No accounts selected. Select accounts to filter results or leave all unchecked to include all." :
                      `Selected ${selectedOrganizations.length} account(s).`}
                  </div>
                </>
              ) : (
                <div className="text-xs" style={{ color: 'var(--foreground)' }}>
                  No GitHub App installations found. Install the GitHub App to access more accounts.
                </div>
              )}
            </div>
          </div>
          
          {/* Group By options */}
          <div>
            <h4 className="text-xs mb-2 font-bold" style={{ color: 'var(--electric-blue)' }}>GROUP RESULTS BY</h4>
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { value: 'chronological', label: 'NO GROUPING' },
                  { value: 'contributor', label: 'CONTRIBUTOR' },
                  { value: 'organization', label: 'ORGANIZATION' },
                  { value: 'repository', label: 'REPOSITORY' }
                ].map(option => (
                  <div key={option.value} className="flex items-center">
                    <input 
                      type="radio" 
                      id={`group-${option.value}`}
                      name="groupBy"
                      value={option.value}
                      checked={groupBy === option.value}
                      onChange={() => setGroupBy(option.value as any)}
                      disabled={isLoading}
                      className="mr-2"
                      style={{ 
                        accentColor: 'var(--neon-green)'
                      }}
                    />
                    <label 
                      htmlFor={`group-${option.value}`} 
                      className="text-xs"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
              
              {/* Option to generate AI summaries for each group */}
              {groupBy !== 'chronological' && (
                <div className="flex items-center mt-2">
                  <input 
                    type="checkbox" 
                    id="generate-group-summaries"
                    checked={generateGroupSummaries}
                    onChange={(e) => setGenerateGroupSummaries(e.target.checked)}
                    disabled={isLoading}
                    className="mr-2"
                    style={{ 
                      accentColor: 'var(--neon-green)'
                    }}
                  />
                  <label 
                    htmlFor="generate-group-summaries" 
                    className="text-xs"
                    style={{ color: 'var(--foreground)' }}
                  >
                    GENERATE AI SUMMARY FOR EACH GROUP
                  </label>
                </div>
              )}
            </div>
          </div>
          
          {/* Reset button */}
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="px-3 py-1 text-xs rounded transition-all duration-200"
              style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--crimson-red)',
                border: '1px solid var(--crimson-red)'
              }}
            >
              RESET FILTERS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}