/**
 * API route for generating summaries of GitHub activity
 * 
 * Refactored to use effect-based architecture with functional core/imperative shell pattern
 * Maintains backward compatibility with existing API clients
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createAuthOptions } from "@/lib/auth/authConfig";
import { 
  getAllAppInstallations,
  type AppInstallation
} from "@/lib/github";
import { logger } from "@/lib/logger";
import { generateCommitSummary } from "@/lib/gemini";
import { summaryService } from "@/services/workflows/summary";
import { 
  createGitHubDataProvider, 
  createRepositoryProvider,
  type GitHubProviderConfig,
  type ExtendedGitHubDataProvider
} from "@/services/providers/github";
import {
  transformLegacyRequestToSummaryRequest,
  transformSummaryStatsToLegacyResponse,
  parseRepositoryFilters,
  createLegacyFilterInfo,
  type LegacySummaryResponse
} from "@/services/adapters/legacy-api";

const MODULE_NAME = "api:summary";

/**
 * POST handler for summary generation
 * Accepts JSON body format from frontend
 */
export async function POST(request: NextRequest) {
  logger.debug(MODULE_NAME, "POST /api/summary request received");

  try {
    // Parse JSON body
    const body = await request.json();

    // Transform POST body to query parameters for GET handler logic
    const searchParams = new URLSearchParams();

    // Required parameters
    if (body.since) searchParams.set('since', body.since);
    if (body.until) searchParams.set('until', body.until);

    // Optional parameters
    if (body.installationIds?.length > 0) {
      searchParams.set('installation_ids', body.installationIds.join(','));
    }
    if (body.organizations?.length > 0) {
      searchParams.set('organizations', body.organizations.join(','));
    }
    if (body.repositories?.length > 0) {
      searchParams.set('repositories', body.repositories.join(','));
    }
    if (body.activityMode) {
      searchParams.set('activity_mode', body.activityMode);
    }
    if (body.contributors?.length > 0) {
      searchParams.set('contributors', body.contributors.join(','));
    }

    // Create a new request with the query parameters
    const url = new URL(request.url);
    url.search = searchParams.toString();
    const getRequest = new NextRequest(url, {
      headers: request.headers,
      method: 'GET'
    });

    // Call the GET handler with transformed request
    return GET(getRequest);

  } catch (error) {
    logger.error(MODULE_NAME, "Error processing POST request", { error });

    if (error instanceof SyntaxError) {
      return new NextResponse(JSON.stringify({
        error: "Invalid JSON in request body"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new NextResponse(JSON.stringify({
      error: "Failed to process request",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function GET(request: NextRequest) {
  logger.debug(MODULE_NAME, "GET /api/summary request received", {
    url: request.url,
    searchParams: Object.fromEntries(request.nextUrl.searchParams.entries())
  });

  // 1. Authentication and Session Management
  const session = await getServerSession(createAuthOptions());
  
  if (!session) {
    logger.warn(MODULE_NAME, "Unauthorized request - no valid session");
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // 2. Validate Required Environment Variables
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    logger.error(MODULE_NAME, "Missing Gemini API key in environment variables");
    return new NextResponse(JSON.stringify({ 
      error: "Server configuration error: Missing Gemini API key" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 3. Basic Parameter Validation
  const searchParams = request.nextUrl.searchParams;
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  
  if (!since || !until) {
    logger.warn(MODULE_NAME, "Missing required date parameters");
    return new NextResponse(JSON.stringify({ 
      error: "Missing required parameters: since and until dates" 
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const requestStartTime = Date.now();

    // 4. GitHub Installation and Authentication Setup
    const { installationIds, allInstallations } = await setupGitHubAuthentication(
      request, 
      session
    );

    if (installationIds.length === 0 && !session.accessToken) {
      logger.warn(MODULE_NAME, "No authentication method available");
      return new NextResponse(JSON.stringify({ 
        error: "GitHub authentication required",
        needsInstallation: true,
        message: "Please install the GitHub App to access your repositories."
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    logger.info(MODULE_NAME, "Authenticated user requesting summary", { 
      user: session.user?.email || session.user?.name || 'unknown',
      authMethod: installationIds.length > 0 ? "GitHub App" : "OAuth",
      installationCount: installationIds.length
    });

    // 5. Repository Fetching and Filtering (Imperative Shell)
    const providerConfig: GitHubProviderConfig = {
      accessToken: session.accessToken,
      installationIds,
      currentUserName: session.user?.name || undefined
    };

    const repositoryProvider = createRepositoryProvider(providerConfig);
    const repositories = await repositoryProvider.fetchRepositories()();
    
    const { organizations, repositoryFilters } = parseRepositoryFilters(request);
    const filteredRepos = repositoryProvider.filterRepositories(
      repositories, 
      organizations, 
      repositoryFilters
    );
    
    const reposToAnalyze = filteredRepos.map(repo => repo.full_name);
    
    logger.debug(MODULE_NAME, "Repositories to analyze after filtering", { 
      count: reposToAnalyze.length
    });
    
    if (reposToAnalyze.length === 0) {
      const filterInfo = createLegacyFilterInfo(request, []);
      logger.warn(MODULE_NAME, "No repositories match the filter criteria");
      return new NextResponse(JSON.stringify({ 
        error: "No repositories match the specified filters",
        filterInfo
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 6. Core Business Logic - Effect-Based Summary Service
    const dataProvider: ExtendedGitHubDataProvider = createGitHubDataProvider(providerConfig);
    const summaryRequest = transformLegacyRequestToSummaryRequest(request, reposToAnalyze);
    
    // Create and execute the effect
    const summaryEffect = summaryService.generateSummary(summaryRequest, dataProvider);
    const summaryStats = await summaryEffect();

    logger.info(MODULE_NAME, "Generated summary statistics", {
      totalCommits: summaryStats.totalCommits,
      uniqueAuthors: summaryStats.uniqueAuthors,
      repositories: summaryStats.repositories.length
    });

    // 7. Fetch Original Commits and Generate AI Summary (Legacy Requirements)
    let aiSummary = null;
    let originalCommits: any[] = [];
    
    if (summaryStats.totalCommits > 0) {
      // Fetch raw commits for AI summary generation (maintains GitHub API format)
      const rawCommits = await dataProvider.fetchRawCommits(
        summaryRequest.repositories,
        summaryRequest.dateRange,
        summaryRequest.branch
      )();
      
      originalCommits = [...rawCommits];

      const aiSummaryStartTime = Date.now();
      aiSummary = await generateCommitSummary(originalCommits, geminiApiKey);
      logger.info(MODULE_NAME, "Generated AI summary", {
        timeMs: Date.now() - aiSummaryStartTime,
        keyThemes: aiSummary?.keyThemes?.length || 0
      });
    }

    // 8. Response Transformation (Maintain Backward Compatibility)
    const filterInfo = createLegacyFilterInfo(request, reposToAnalyze);

    let legacyResponse = transformSummaryStatsToLegacyResponse(
      summaryStats,
      originalCommits,
      filterInfo,
      session.user?.name || undefined,
      installationIds.length > 0 ? "github_app" : "oauth",
      installationIds,
      allInstallations
    );

    // Add AI summary to response
    legacyResponse.aiSummary = aiSummary;
    legacyResponse.groupedResults[0].aiSummary = aiSummary;

    const totalTime = Date.now() - requestStartTime;
    logger.info(MODULE_NAME, "Completed summary request", {
      totalTimeMs: totalTime,
      commitCount: summaryStats.totalCommits,
      repositoryCount: summaryStats.repositories.length
    });
    
    return NextResponse.json(legacyResponse);

  } catch (error) {
    logger.error(MODULE_NAME, "Error generating summary", { 
      error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return handleApiError(error);
  }
}

/**
 * Setup GitHub authentication and installations
 */
async function setupGitHubAuthentication(
  request: NextRequest, 
  session: any
): Promise<{
  installationIds: number[],
  allInstallations: AppInstallation[]
}> {
  const searchParams = request.nextUrl.searchParams;
  
  // Parse installation IDs from request
  let requestedInstallationIds = searchParams.get('installation_ids');
  let installationIds: number[] = [];
  
  if (requestedInstallationIds) {
    installationIds = requestedInstallationIds
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => !isNaN(id));
      
    logger.debug(MODULE_NAME, "Parsed installation IDs from request", { installationIds });
  } else if (session.installationId) {
    installationIds = [session.installationId];
  }

  // Get all available installations
  let allInstallations: AppInstallation[] = [];
  if (session.accessToken) {
    try {
      allInstallations = await getAllAppInstallations(session.accessToken);
      logger.info(MODULE_NAME, "Retrieved all GitHub App installations", {
        count: allInstallations.length
      });
      
      // Use first available installation if none specified
      if (installationIds.length === 0 && allInstallations.length > 0) {
        installationIds = [allInstallations[0].id];
        logger.info(MODULE_NAME, "Using first available installation", {
          installationId: allInstallations[0].id
        });
      }
      
      // Validate requested installation IDs
      if (installationIds.length > 0 && allInstallations.length > 0) {
        const validInstallationIds = installationIds.filter(id => 
          allInstallations.some(inst => inst.id === id)
        );
        
        if (validInstallationIds.length === 0 && allInstallations.length > 0) {
          installationIds = [allInstallations[0].id];
          logger.warn(MODULE_NAME, "No valid installation IDs found, using default");
        } else {
          installationIds = validInstallationIds;
        }
      }
    } catch (error) {
      logger.warn(MODULE_NAME, "Error getting GitHub App installations", { error });
    }
  }
  
  // Check cookies as fallback
  if (installationIds.length === 0) {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader && cookieHeader.includes('github_installation_id=')) {
      const match = cookieHeader.match(/github_installation_id=([^;]+)/);
      if (match && match[1]) {
        const cookieId = parseInt(match[1], 10);
        installationIds = [cookieId];
        logger.info(MODULE_NAME, "Found installation ID in cookie", { installationId: cookieId });
      }
    }
  }

  return { installationIds, allInstallations };
}

/**
 * Handle API errors with appropriate HTTP responses
 */
function handleApiError(error: unknown): NextResponse {
  const errorObj = error as { name?: string; message?: string } || {};
  const errorName = errorObj.name || '';
  const errorMsg = errorObj.message || '';
  
  // Handle validation errors from the summary service
  if (errorMsg.includes('Validation failed')) {
    return new NextResponse(JSON.stringify({ 
      error: "Invalid request parameters", 
      details: errorMsg,
      code: "VALIDATION_ERROR"
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Handle authentication errors
  const isAuthError = errorName === 'HttpError' && 
                    (errorMsg.includes('credentials') || 
                     errorMsg.includes('authentication'));
  
  const isAppError = errorMsg.includes('GitHub App credentials not configured');
  
  let errorMessage = "Failed to generate summary";
  let errorCode = "API_ERROR";
  let statusCode = 500;
  
  if (isAppError) {
    errorMessage = "GitHub App not properly configured. Please contact the administrator.";
    errorCode = "GITHUB_APP_CONFIG_ERROR";
    statusCode = 403;
  } else if (isAuthError) {
    errorMessage = "GitHub authentication failed. Your authentication is invalid or expired.";
    errorCode = "GITHUB_AUTH_ERROR";
    statusCode = 403;
  } else if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
    errorMessage = "Failed to fetch data from GitHub. Please check your connection and try again.";
    errorCode = "NETWORK_ERROR";
    statusCode = 502;
  } else if (errorMsg.includes('timeout')) {
    errorMessage = "Request timed out. Try selecting fewer repositories or a shorter date range.";
    errorCode = "TIMEOUT_ERROR";
    statusCode = 408;
  }
  
  return new NextResponse(JSON.stringify({ 
    error: errorMessage, 
    details: error instanceof Error ? error.message : "Unknown error",
    code: errorCode
  }), {
    status: statusCode,
    headers: { "Content-Type": "application/json" }
  });
}