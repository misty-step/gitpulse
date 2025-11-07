import type { ReportContext } from "./reportContext.js";

/**
 * Prompt Engineering for Report Generation (Convex)
 *
 * Adapted from packages/ai/src/prompts.ts for Convex environment.
 * Deep module: Simple prompt building interface hiding template complexity.
 * Citation enforcement: Every factual claim must include GitHub URL.
 */

/**
 * User KPIs structure
 */
export interface UserKPIs {
  login: string;
  prsOpened: number;
  commits: number;
  reviews: number;
}

/**
 * Search result structure
 */
export interface SearchResult {
  similarity: number;
  metadata: {
    type?: string;
    repo?: string;
    user?: string;
    url?: string;
    [key: string]: unknown;
  };
  url?: string;
}

/**
 * Build system prompt for report generation
 *
 * Enforces citation rules:
 * - Every factual claim MUST include a citation
 * - Citations use markdown format: [text](url)
 * - If no data available, explicitly state "not found"
 * - No hallucinations or unsupported claims
 *
 * @returns System prompt string
 */
export function buildSystemPrompt(): string {
  return `You are an engineering activity analyst specializing in GitHub data analysis.

CRITICAL RULES:
1. Only use the structured data provided in the user message; never invent events or metrics.
2. EVERY factual claim about PRs, commits, reviews, or code must cite a GitHub URL from the provided allowed list.
3. Use markdown link format: [descriptive text](https://github.com/...)
4. If the data does not cover a topic, explicitly state "no data found" instead of speculating.
5. Write in confident, technical prose with concrete details pulled from the context.
6. Keep section ordering exactly as instructed and avoid adding extra headings.`;
}

/**
 * Build user prompt with KPI data and vector context
 *
 * Formats the KPI statistics and semantic search results into a structured prompt.
 *
 * @param kpis - User KPI data from getUserKPIs()
 * @param searchResults - Semantic search results from vector search
 * @param fromDate - Start of time range (ISO string)
 * @param toDate - End of time range (ISO string)
 * @param query - Optional natural language query context
 * @returns User prompt string
 */
export function buildUserPrompt(
  kpis: UserKPIs[],
  searchResults: SearchResult[],
  fromDate: string,
  toDate: string,
  query?: string
): string {
  // Format time range
  const from = new Date(fromDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const to = new Date(toDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build prompt sections
  const sections: string[] = [];

  // 1. Query context (if provided)
  if (query) {
    sections.push(`QUERY: ${query}\n`);
  }

  // 2. Time range
  sections.push(`TIME RANGE: ${from} to ${to}\n`);

  // 3. KPI Data
  sections.push(`KEY PERFORMANCE INDICATORS:\n`);
  if (kpis.length === 0) {
    sections.push(`No KPI data available for the specified time range.\n`);
  } else {
    kpis.forEach((kpi) => {
      sections.push(`User: ${kpi.login}`);
      sections.push(`  - PRs Opened: ${kpi.prsOpened}`);
      sections.push(`  - Commits: ${kpi.commits}`);
      sections.push(`  - Reviews: ${kpi.reviews}\n`);
    });
  }

  // 4. Semantic Context (vector search results)
  if (searchResults.length > 0) {
    sections.push(`\nRELEVANT ACTIVITY (with citations):\n`);
    searchResults.forEach((result, idx) => {
      const meta = result.metadata;
      const url = result.url || "No URL available";
      const similarity = (result.similarity * 100).toFixed(1);

      sections.push(
        `${idx + 1}. [${meta.type || "activity"}] in ${meta.repo || "unknown repo"} by ${meta.user || "unknown user"}`
      );
      sections.push(`   Relevance: ${similarity}%`);
      sections.push(`   Citation: ${url}\n`);
    });
  } else {
    sections.push(
      `\nNo semantic search results available. Use only KPI data above.\n`
    );
  }

  // 5. Task instruction
  sections.push(
    `\nTASK: Generate a concise activity report for the time range above. Include:`
  );
  sections.push(`- Summary of contributions (2-3 sentences)`);
  sections.push(`- Key metrics table (if multiple users, show comparison)`);
  sections.push(
    `- Notable PRs or commits with [text](URL) citations from the relevant activity section`
  );
  sections.push(`- Any patterns or insights visible in the data`);
  sections.push(
    `\nRemember: EVERY claim about specific PRs, commits, or code changes MUST include a GitHub URL citation.`
  );

  return sections.join("\n");
}

export interface PromptPayload {
  systemPrompt: string;
  userPrompt: string;
  requiredHeadings: string[];
  minWordCount: number;
  allowedUrls: string[];
}

/**
 * Extract GitHub URLs from markdown citations
 *
 * Finds all markdown-style links: [text](url)
 * Filters for GitHub URLs only
 *
 * @param markdown - Generated markdown text
 * @returns Array of unique GitHub URLs
 */
export function extractCitations(markdown: string): string[] {
  // Regex to match markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const url = match[2];
    // Only include GitHub URLs
    if (url && url.includes("github.com")) {
      urls.push(url);
    }
  }

  // Return unique URLs
  return [...new Set(urls)];
}

/**
 * Simple hash function for prompt versioning
 *
 * Uses a simple string hash for cache invalidation.
 * When prompts change, the hash changes.
 *
 * @param str - String to hash
 * @returns Numeric hash as string
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate prompt version hash for cache invalidation
 *
 * Creates a deterministic hash of the system and user prompt templates.
 * When prompts change, the hash changes, invalidating cached responses.
 *
 * @returns Hash of prompt templates
 */
export function getPromptVersion(): string {
  // Combine system and user prompt templates
  const systemTemplate = buildSystemPrompt();

  // For user prompt, use a placeholder version to capture structure
  const userTemplate = buildUserPrompt(
    [{ login: "USER", prsOpened: 0, commits: 0, reviews: 0 }],
    [],
    "2025-01-01T00:00:00.000Z",
    "2025-12-31T00:00:00.000Z",
    "QUERY"
  );

  const combined = `${systemTemplate}\n\n${userTemplate}`;

  return simpleHash(combined);
}

/**
 * Prompt version metadata
 */
export interface PromptVersion {
  /** Version hash */
  version: string;
  /** Timestamp when version was generated */
  timestamp: number;
  /** Human-readable description */
  description: string;
}

/**
 * Get current prompt version with metadata
 *
 * Useful for debugging and tracking when prompts change.
 *
 * @returns Prompt version with metadata
 */
export function getCurrentPromptVersion(): PromptVersion {
  return {
    version: getPromptVersion(),
    timestamp: Date.now(),
    description:
      "Citation-enforced GitHub activity prompts with KPI + vector context",
  };
}

/**
 * Build daily standup prompt
 *
 * Lightweight, outcome-focused summary for personal daily standups.
 * User reads this at 9am to remember what they were working on.
 *
 * @param githubUsername - User's GitHub username
 * @param date - Date of the standup
 * @param events - Array of GitHub events with lightweight context
 * @param repoCount - Number of unique repos with activity
 * @returns Prompt string for Gemini
 */
export function buildDailyStandupPrompt(
  githubUsername: string,
  context: ReportContext,
  allowedUrls: string[]
): PromptPayload {
  const endDate = new Date(context.timeframe.end);
  const dateLabel = endDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const contextJson = JSON.stringify(context, null, 2);
  const allowedList =
    allowedUrls.length > 0
      ? allowedUrls.map((url) => `- ${url}`).join("\n")
      : "- (no URLs available; state this explicitly if you cannot cite)";

  const userPrompt = `You are preparing ${githubUsername}'s daily standup for ${dateLabel}.

Use ONLY the structured JSON context below. Do not guess or introduce work that is not present.

Follow this outline exactly and write in natural paragraphs (no bullet lists):
## Work Completed
## Key Decisions & Context
## Momentum & Next Steps

Every concrete claim about code must cite one of the allowed GitHub URLs. If no URL exists for a detail, acknowledge the gap instead of inventing a citation.

<ALLOWED_URLS>
${allowedList}
</ALLOWED_URLS>

<CONTEXT_JSON>
\`\`\`json
${contextJson}
\`\`\`
</CONTEXT_JSON>

Make the report specific and technical. Pull commit messages, PR titles, review notes, and repository focus from the timeline data. Highlight patterns and momentum that would help ${githubUsername} plan the next work session.`;

  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt,
    requiredHeadings: [
      "## Work Completed",
      "## Key Decisions & Context",
      "## Momentum & Next Steps",
    ],
    minWordCount: 350,
    allowedUrls,
  };
}

/**
 * Build weekly retro prompt
 *
 * Deeper reflection, pattern identification, forward-looking insights.
 * Different tone and structure than daily standup.
 *
 * @param githubUsername - User's GitHub username
 * @param startDate - Start of week
 * @param endDate - End of week
 * @param events - Array of GitHub events with lightweight context
 * @param repoCount - Number of unique repos with activity
 * @returns Prompt string for Gemini
 */
export function buildWeeklyRetroPrompt(
  githubUsername: string,
  context: ReportContext,
  allowedUrls: string[]
): PromptPayload {
  const startLabel = new Date(context.timeframe.start).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
  const endLabel = new Date(context.timeframe.end).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  const contextJson = JSON.stringify(context, null, 2);
  const allowedList =
    allowedUrls.length > 0
      ? allowedUrls.map((url) => `- ${url}`).join("\n")
      : "- (no URLs available; note gaps explicitly)";

  const userPrompt = `You are preparing a weekly retrospective for ${githubUsername} covering ${startLabel} through ${endLabel}.

Use the JSON context as your single source of truth. Emphasise narrative cohesion: group related work, highlight repository focus, and call out technical decision points.

Required outline (keep headings verbatim, write in paragraphs):
## Accomplishments
## Technical Insights
## Challenges & Growth
## Momentum & Direction

Every detailed claim about code must cite an allowed GitHub URL. If a relevant URL is missing, call it out rather than inventing one.

<ALLOWED_URLS>
${allowedList}
</ALLOWED_URLS>

<CONTEXT_JSON>
\`\`\`json
${contextJson}
\`\`\`
</CONTEXT_JSON>

Surface meaningful patterns: concentrations of work in particular repositories, notable PRs or reviews, and emerging themes for the upcoming week. Keep the tone analytical and forward-looking.`;

  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt,
    requiredHeadings: [
      "## Accomplishments",
      "## Technical Insights",
      "## Challenges & Growth",
      "## Momentum & Direction",
    ],
    minWordCount: 700,
    allowedUrls,
  };
}
