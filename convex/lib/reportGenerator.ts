import {
  buildDailyStandupPrompt,
  buildWeeklyRetroPrompt,
  extractCitations,
  type PromptPayload,
} from "./prompts.js";
import type { ReportContext } from "./reportContext.js";
import { markdownToHtml } from "./markdown.js";
import {
  generateWithOrchestrator,
  validateLLMMarkdown,
} from "./llmOrchestrator.js";
import { logger } from "./logger.js";

export interface GeneratedReport {
  markdown: string;
  html: string;
  citations: string[];
  provider: string;
  model: string;
}

export async function generateDailyReportFromContext(
  githubUsername: string,
  context: ReportContext,
  allowedUrls: string[],
): Promise<GeneratedReport> {
  try {
    if (context.totals.eventCount === 0) {
      const date = new Date(context.timeframe.end).toLocaleDateString("en-US");
      const markdown = `## Work Completed
No GitHub activity was recorded for ${githubUsername} on ${date}. This standup reflects an idle day—no commits, pull requests, or reviews landed during the 24-hour window.

## Key Decisions & Context
There were no recorded discussions or code reviews for this period. If work happened elsewhere (pairing, planning, meetings), capture it manually.

## Momentum & Next Steps
All previously active threads remain in their prior state. Consider reviewing open branches or issues to re-establish momentum today.`;

      return {
        markdown,
        html: markdownToHtml(markdown),
        citations: [],
        provider: "system",
        model: "none",
      };
    }

    const prompt = buildDailyStandupPrompt(
      githubUsername,
      context,
      allowedUrls,
    );
    return await generateWithPrompt("daily", prompt, allowedUrls);
  } catch (error) {
    logger.error(
      { err: error, githubUsername },
      "Daily standup generation failed after fallback, returning synthetic summary",
    );
    return buildSyntheticDailyReport(githubUsername, context);
  }
}

export async function generateWeeklyReportFromContext(
  githubUsername: string,
  context: ReportContext,
  allowedUrls: string[],
): Promise<GeneratedReport> {
  try {
    if (context.totals.eventCount === 0) {
      const start = new Date(context.timeframe.start).toLocaleDateString(
        "en-US",
      );
      const end = new Date(context.timeframe.end).toLocaleDateString("en-US");
      const markdown = `## Accomplishments
No GitHub activity was captured for ${githubUsername} between ${start} and ${end}. Without commits or pull requests, there are no deliverables to highlight from the repository data.

## Technical Insights
With no recorded code changes, the telemetry cannot surface architectural or tooling insights this week. If work happened outside GitHub (planning, research, incidents), document it manually.

## Challenges & Growth
No repository activity means no observable challenges in version control. If this reflects planned time away, call it out; otherwise consider diagnosing pipeline or ingestion gaps.

## Momentum & Direction
Momentum is effectively paused in GitHub history. Review open issues and branches next week to restart progress, and confirm that ingestion pipelines are healthy if activity should have been present.`;

      return {
        markdown,
        html: markdownToHtml(markdown),
        citations: [],
        provider: "system",
        model: "none",
      };
    }

    const prompt = buildWeeklyRetroPrompt(githubUsername, context, allowedUrls);
    return await generateWithPrompt("weekly", prompt, allowedUrls);
  } catch (error) {
    logger.error(
      { err: error, githubUsername },
      "Weekly retro generation failed after fallback, returning synthetic summary",
    );
    return buildSyntheticWeeklyReport(githubUsername, context);
  }
}

async function generateWithPrompt(
  kind: "daily" | "weekly",
  prompt: PromptPayload,
  allowedUrls: string[],
): Promise<GeneratedReport> {
  const generation = await generateWithOrchestrator(kind, prompt);
  const validationErrors = validateLLMMarkdown(generation.markdown, prompt);
  if (validationErrors.length > 0) {
    throw new Error(`Report validation failed: ${validationErrors.join("; ")}`);
  }

  const markdown = generation.markdown.trim();
  const html = markdownToHtml(markdown);
  const citations = filterCitations(extractCitations(markdown), allowedUrls);

  return {
    markdown,
    html,
    citations,
    provider: generation.provider,
    model: generation.model,
  };
}

interface GenerationResult {
  markdown: string;
  provider: string;
  model: string;
}

function filterCitations(citations: string[], allowedUrls: string[]): string[] {
  if (allowedUrls.length === 0) {
    return [];
  }

  const allowed = new Set(allowedUrls);
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const url of citations) {
    if (allowed.has(url) && !seen.has(url)) {
      unique.push(url);
      seen.add(url);
    }
  }

  return unique;
}

export function buildSyntheticDailyReport(
  githubUsername: string,
  context: ReportContext,
): GeneratedReport {
  const date = new Date(context.timeframe.end).toLocaleDateString("en-US");
  const markdown = `## Work Completed
Generation failed due to upstream model errors, so this fallback summarizes telemetry directly. ${githubUsername} recorded ${context.totals.byType.commit ?? 0} commits, ${context.totals.byType.pr_opened ?? 0} pull requests, and ${context.totals.byType.review ?? 0} reviews on ${date}. Refer to the dashboard for raw activity details.

## Key Decisions & Context
Automatic analysis was unavailable. Review the timeline data in the app to extract decision points or notable discussions manually if needed.

## Momentum & Next Steps
Momentum indicators are unavailable from the model. Check ongoing branches or issues to plan today's focus and confirm ingestion pipelines are healthy.`;

  return {
    markdown,
    html: markdownToHtml(markdown),
    citations: [],
    provider: "system",
    model: "none",
  };
}

export function buildSyntheticWeeklyReport(
  githubUsername: string,
  context: ReportContext,
): GeneratedReport {
  const start = new Date(context.timeframe.start).toLocaleDateString("en-US");
  const end = new Date(context.timeframe.end).toLocaleDateString("en-US");
  const markdown = `## Accomplishments
Automated summarization failed, so this fallback aggregates raw counts: ${githubUsername} logged ${context.totals.byType.commit ?? 0} commits, ${context.totals.byType.pr_opened ?? 0} pull requests, and ${context.totals.byType.review ?? 0} reviews across ${context.repos.length} repositories between ${start} and ${end}.

## Technical Insights
Review repository timelines in the dashboard to understand hotspots—fallback mode cannot cluster the activity. Prioritize repositories with the highest event counts for manual inspection.

## Challenges & Growth
LLM insight generation was unavailable. If challenges emerged, capture them manually along with any remediation steps taken during the week.

## Momentum & Direction
To restore momentum visibility, inspect open PRs and issues for current status. Consider rerunning report generation once the LLM providers are reachable to regain narrative coverage.`;

  return {
    markdown,
    html: markdownToHtml(markdown),
    citations: [],
    provider: "system",
    model: "none",
  };
}
