/**
 * Type definitions for the GitPulse dashboard
 */

/**
 * Represents the state of filters applied in the dashboard
 */
export interface FilterState {
  readonly contributors: readonly string[];
  readonly organizations: readonly string[];
  readonly repositories: readonly string[];
}

/**
 * Represents a GitHub repository
 */
export interface Repository {
  readonly id: number;
  readonly full_name: string;
  readonly name: string;
  readonly owner: {
    readonly login: string;
  };
  readonly private: boolean;
  readonly language?: string | null;
  readonly updated_at?: string | null;
}

/**
 * Represents an AI-generated summary of activity
 */
export interface AISummary {
  readonly keyThemes: readonly string[];
  readonly technicalAreas: readonly {
    readonly name: string;
    readonly count: number;
  }[];
  readonly accomplishments: readonly string[];
  readonly commitsByType: readonly {
    readonly type: string;
    readonly count: number;
    readonly description: string;
  }[];
  readonly timelineHighlights: readonly {
    readonly date: string;
    readonly description: string;
  }[];
  readonly overallSummary: string;
}

/**
 * Represents a summary of commits
 */
export interface CommitSummary {
  readonly user?: string;
  readonly commits: readonly unknown[];
  readonly stats: {
    readonly totalCommits: number;
    readonly repositories: readonly string[];
    readonly dates: readonly string[];
  };
  readonly aiSummary?: AISummary;
  readonly authMethod?: string;
  readonly installationId?: number | null;
  readonly filterInfo?: {
    readonly contributors: readonly string[] | null;
    readonly organizations: readonly string[] | null;
    readonly repositories: readonly string[] | null;
    readonly dateRange: { 
      readonly since: string; 
      readonly until: string 
    };
  };
}

/**
 * Represents an account associated with a GitHub App installation
 */
export interface InstallationAccount {
  readonly login: string;
  readonly type: string;
  readonly avatarUrl?: string;
}

/**
 * Represents a GitHub App installation
 */
export interface Installation {
  readonly id: number;
  readonly account: InstallationAccount;
  readonly appSlug: string;
  readonly appId: number;
  readonly repositorySelection: string;
  readonly targetType: string;
}

/**
 * Response format for repositories API endpoint
 */
export interface ReposResponse {
  readonly repositories: readonly Repository[];
  readonly authMethod?: string;
  readonly installationId?: number | null;
  readonly installationIds?: readonly number[];
  readonly installations?: readonly Installation[];
  readonly currentInstallation?: Installation | null;
  readonly currentInstallations?: readonly Installation[];
}

/**
 * Possible activity modes for the dashboard
 */
export type ActivityMode = 'my-activity' | 'my-work-activity' | 'team-activity';

/**
 * Represents a date range selection
 */
export interface DateRange {
  readonly since: string;
  readonly until: string;
}