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
    <section>
      {/* Simplified header */}
      <div>
        <h2>
          Commit Analysis
        </h2>
        <span>
          Active
        </span>
      </div>

      {/* Clean error display */}
      {error && (
        <div>
          <div>
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>{error}</div>
          </div>
          <div>
            {needsInstallation && (
              <>
                {getGitHubAppInstallUrl() === "#github-app-not-configured" ? (
                  <div>
                    App Not Configured
                  </div>
                ) : (
                  <a
                    href={getGitHubAppInstallUrl()}>
                    Install GitHub App
                  </a>
                )}
              </>
            )}
            {error.includes('authentication') && (
              <button
               
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
        <div>
          <div>
            <div>
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                {authMethod === 'github_app' 
                  ? 'GITHUB APP INTEGRATION ACTIVE' 
                  : 'USING OAUTH AUTHENTICATION'}
              </div>
            </div>
            
            <div>
              {/* Install More Accounts button */}
              {authMethod === 'github_app' && installations.length > 0 && (
                <a
                  href={getGitHubAppInstallUrl()}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                >
                  MANAGE
                </a>
              )}
              
              {/* Install button for OAuth users */}
              {authMethod !== 'github_app' && !needsInstallation && (
                <>
                  {getGitHubAppInstallUrl() === "#github-app-not-configured" ? (
                    <div>
                      APP NEEDS SETUP
                    </div>
                  ) : (
                    <a
                      href={getGitHubAppInstallUrl()}>
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
        <div>
          <div>
            <div>
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>AVAILABLE ACCOUNTS & ORGANIZATIONS</span>
            </div>
            
            <div>
              <a
                href={getGitHubAppInstallUrl()}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                >
                  MANAGE CURRENT
                </a>
              )}
            </div>
          </div>
          
          <div>
            <div>
              <div>ACTIVE ACCOUNTS:</div>
              {installations.length > 0 && (
                <div>
                  <div>ACTIVE ACCOUNTS:</div>
                  {/* Render account selector component */}
                  <div>
                    {currentInstallations.length === 0 ? (
                      <div>
                        No accounts selected. Select accounts to analyze.
                      </div>
                    ) : (
                      <div>
                        {currentInstallations.map(installation => (
                          <div 
                            key={installation.id}>
                            {installation.account.login}
                            <button
                              onClick={handleSignOut}
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
              
              <div>
                Select one or more accounts to analyze. This determines which repositories you&apos;ll have access to for analysis.
              </div>
            </div>
          </div>
        </div>
      )}
      
      {(activityMode === 'my-work-activity' || activityMode === 'team-activity') && (
        <div>
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
    </section>
  );
}
