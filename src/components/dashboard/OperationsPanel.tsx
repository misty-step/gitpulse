import React from 'react';
import OrganizationPicker from '@/components/OrganizationPicker';
import { ActivityMode, Installation } from '@/types/dashboard';
import { getGitHubAppInstallUrl } from '@/lib/dashboard-utils';
import { getInstallationManagementUrl } from '@/lib/github/auth';

export interface OperationsPanelProps {
  /**
   * Current error message to display
   */
  error: string | null;
  
  /**
   * Whether the panel is in a loading state
   */
  loading: boolean;
  
  /**
   * Whether GitHub App installation is needed
   */
  needsInstallation: boolean;
  
  /**
   * Authentication method (github_app or oauth)
   */
  authMethod: string | null;
  
  /**
   * List of available GitHub App installations
   */
  installations: readonly Installation[];
  
  /**
   * List of current GitHub App installations
   */
  currentInstallations: readonly Installation[];
  
  /**
   * Current activity mode
   */
  activityMode: ActivityMode;
  
  /**
   * Current active filters
   */
  activeFilters: {
    contributors: string[];
    organizations: string[];
    repositories: string[];
  };
  
  /**
   * Current user's name
   */
  userName?: string | null;
  
  /**
   * Function to handle organization selection changes
   */
  onOrganizationChange: (selectedOrgs: string[]) => void;
  
  /**
   * Function to switch between GitHub installations
   */
  onSwitchInstallations: (installIds: number[]) => void;
  
  /**
   * Function to sign out
   */
  onSignOut: (options?: { callbackUrl: string }) => void;
}

/**
 * Operations Panel component displaying error messages, auth status, and filters
 */
export default function OperationsPanel({
  error,
  loading,
  needsInstallation,
  authMethod,
  installations,
  currentInstallations,
  activityMode,
  activeFilters,
  userName,
  onOrganizationChange,
  onSwitchInstallations,
  onSignOut
}: OperationsPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-1.5 mb-4 shadow-sm">
      {/* Simplified header */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Commit Analysis
        </h2>
        <span className="text-xs text-green-600 dark:text-green-400">
          Active
        </span>
      </div>

      {/* Clean error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex flex-col md:flex-row md:items-center">
          <div className="flex items-start text-red-700 dark:text-red-400">
            <svg className="h-5 w-5 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>{error}</div>
          </div>
          <div className="md:ml-auto mt-3 md:mt-0 flex space-x-3">
            {needsInstallation && (
              <>
                {getGitHubAppInstallUrl() === "#github-app-not-configured" ? (
                  <div className="px-3 py-1 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded">
                    App Not Configured
                  </div>
                ) : (
                  <a
                    href={getGitHubAppInstallUrl()}
                    className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    Install GitHub App
                  </a>
                )}
              </>
            )}
            {error.includes('authentication') && (
              <button
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                onClick={() => onSignOut({ callbackUrl: '/' })}
              >
                Re-authenticate
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* GitHub App authentication status banner */}
      {authMethod && (
        <div className="mb-6 p-3 rounded-md border" style={{
          backgroundColor: authMethod === 'github_app' 
            ? 'rgba(16, 185, 129, 0.1)' 
            : 'rgba(59, 130, 246, 0.1)',
          borderColor: authMethod === 'github_app' 
            ? 'var(--neon-green)' 
            : 'var(--electric-blue)',
          color: authMethod === 'github_app' 
            ? 'var(--neon-green)' 
            : 'var(--electric-blue)'
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                {authMethod === 'github_app' 
                  ? 'GITHUB APP INTEGRATION ACTIVE' 
                  : 'USING OAUTH AUTHENTICATION'}
              </div>
            </div>
            
            <div className="flex space-x-2">
              {/* Install More Accounts button */}
              {authMethod === 'github_app' && installations.length > 0 && (
                <a
                  href={getGitHubAppInstallUrl()}
                  className="text-xs px-2 py-1 rounded-md flex items-center"
                  style={{ 
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--electric-blue)',
                    border: '1px solid var(--electric-blue)'
                  }}
                >
                  <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  ADD ACCOUNT
                </a>
              )}
              
              {/* Manage current installation */}
              {authMethod === 'github_app' && currentInstallations.length > 0 && (
                <a
                  href={getInstallationManagementUrl(
                    currentInstallations[0].id, 
                    currentInstallations[0].account.login, 
                    currentInstallations[0].account.type
                  )}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded-md"
                  style={{ 
                    backgroundColor: 'rgba(249, 250, 251, 0.8)',
                    color: 'var(--neon-green)',
                    border: '1px solid var(--neon-green)'
                  }}
                >
                  MANAGE
                </a>
              )}
              
              {/* Install button for OAuth users */}
              {authMethod !== 'github_app' && !needsInstallation && (
                <>
                  {getGitHubAppInstallUrl() === "#github-app-not-configured" ? (
                    <div className="text-xs px-2 py-1 rounded-md" style={{ 
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: 'var(--crimson-red)',
                      border: '1px solid var(--crimson-red)'
                    }}>
                      APP NEEDS SETUP
                    </div>
                  ) : (
                    <a
                      href={getGitHubAppInstallUrl()}
                      className="text-xs px-2 py-1 rounded-md transition-all duration-200"
                      style={{ 
                        backgroundColor: 'var(--dark-slate)',
                        color: 'var(--neon-green)',
                        border: '1px solid var(--neon-green)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--neon-green)';
                        e.currentTarget.style.color = 'var(--dark-slate)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--dark-slate)';
                        e.currentTarget.style.color = 'var(--neon-green)';
                      }}
                    >
                      UPGRADE TO APP
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Consolidated Account Selection Panel */}
      {authMethod === 'github_app' && installations.length > 0 && (
        <div className="mb-6 p-3 rounded-md border" style={{
          backgroundColor: 'rgba(249, 250, 251, 0.8)',
          borderColor: 'var(--electric-blue)',
        }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--electric-blue)' }}>
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm" style={{ color: 'var(--electric-blue)' }}>AVAILABLE ACCOUNTS & ORGANIZATIONS</span>
            </div>
            
            <div className="flex space-x-2">
              <a
                href={getGitHubAppInstallUrl()}
                className="text-xs px-2 py-1 rounded-md flex items-center"
                style={{ 
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--electric-blue)',
                  border: '1px solid var(--electric-blue)'
                }}
              >
                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                ADD ACCOUNT
              </a>
              
              {currentInstallations.length > 0 && (
                <a
                  href={getInstallationManagementUrl(
                    currentInstallations[0].id, 
                    currentInstallations[0].account.login, 
                    currentInstallations[0].account.type
                  )}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs px-2 py-1 rounded-md"
                  style={{ 
                    backgroundColor: 'rgba(249, 250, 251, 0.8)',
                    color: 'var(--neon-green)',
                    border: '1px solid var(--neon-green)'
                  }}
                >
                  MANAGE CURRENT
                </a>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-full max-w-xl">
              <div className="text-xs font-bold mb-2" style={{ color: 'var(--neon-green)' }}>ACTIVE ACCOUNTS:</div>
              {installations.length > 0 && (
                <div className="w-full">
                  <div className="text-xs font-bold mb-2" style={{ color: 'var(--neon-green)' }}>ACTIVE ACCOUNTS:</div>
                  {/* Render account selector component */}
                  <div className="border p-3 rounded" style={{ borderColor: 'var(--electric-blue)' }}>
                    {currentInstallations.length === 0 ? (
                      <div className="text-xs italic" style={{ color: 'var(--foreground)' }}>
                        No accounts selected. Select accounts to analyze.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {currentInstallations.map(installation => (
                          <div 
                            key={installation.id}
                            className="px-2 py-1 rounded-md text-xs flex items-center"
                            style={{ 
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              color: 'var(--neon-green)',
                              border: '1px solid var(--neon-green)'
                            }}
                          >
                            {installation.account.login}
                            <button
                              onClick={() => {
                                // Remove this installation from current installations
                                const newInstallIds = currentInstallations
                                  .filter(inst => inst.id !== installation.id)
                                  .map(inst => inst.id);
                                onSwitchInstallations(newInstallIds);
                              }}
                              className="ml-2 text-xs"
                              style={{ color: 'var(--neon-green)' }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="mt-2 text-xs" style={{ color: 'var(--foreground)' }}>
                Select one or more accounts to analyze. This determines which repositories you&apos;ll have access to for analysis.
              </div>
            </div>
          </div>
        </div>
      )}
      
      {(activityMode === 'my-work-activity' || activityMode === 'team-activity') && (
        <div className="mt-4">
          <OrganizationPicker
            organizations={installations.map(installation => ({
              id: installation.id,
              login: installation.account.login,
              type: installation.account.type,
              avatarUrl: installation.account.avatarUrl
            }))}
            selectedOrganizations={activeFilters.organizations}
            onSelectionChange={onOrganizationChange}
            mode={activityMode}
            disabled={loading}
            isLoading={loading}
            currentUsername={userName || undefined}
          />
        </div>
      )}
    </div>
  );
}
