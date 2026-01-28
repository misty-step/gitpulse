"use node";

/**
 * Report Generator - Deep Module Design
 *
 * Simple interface: generateReport(userId, window, kind) → report
 * Hides: LLM calls, prompt engineering, citation extraction, metadata formatting
 *
 * Flow: userId + window → events → format → LLM → citations → report
 */

import type { ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { markdownToHtml } from "./markdown";
import { logger } from "./logger.js";
import {
  getLangfuse,
  isLangfuseConfigured,
  flushLangfuse,
  calculateCost,
} from "./langfuse.js";
import { formatReportDate, formatDateRange } from "./timeWindows.js";
import { DailyReportSchema, WeeklyReportSchema } from "./reportSchemas.js";

// ============================================================================
// Types
// ============================================================================

export interface GenerateReportParams {
  userId: string; // Clerk user ID
  startDate: number;
  endDate: number;
  kind: "daily" | "weekly";
  timezone: string; // IANA timezone (e.g., "America/Los_Angeles")
}

export interface GenerateReportResult {
  success: boolean;
  reportId?: Id<"reports">;
  error?: string;
}

interface LLMResult {
  content: string;
  model: string;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate a report for the given user and time window.
 *
 * Simple interface - callers pass exact windows, we generate.
 * Replaces existing report for same window (upsert behavior).
 */
export async function generateReport(
  ctx: ActionCtx,
  params: GenerateReportParams,
): Promise<GenerateReportResult> {
  const { userId, startDate, endDate, kind, timezone } = params;
  const startTime = Date.now();

  // Create Langfuse trace for observability
  const trace = isLangfuseConfigured()
    ? getLangfuse().trace({
        name: "report-generation",
        userId,
        input: { kind, startDate, endDate },
        tags: ["gitpulse", kind],
        metadata: { window: `${startDate}-${endDate}` },
      })
    : null;

  try {
    // 1. Get user
    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: userId,
    });
    if (!user?.githubUsername) {
      logger.warn(
        { userId },
        "Report generation failed: user not found or missing GitHub username",
      );
      return {
        success: false,
        error: "User not found or missing GitHub username",
      };
    }

    // 2. Get user's tracked repos via installations
    const installations = await ctx.runQuery(
      api.installations.listByClerkUser,
      {
        clerkUserId: userId,
      },
    );

    if (installations.length === 0) {
      logger.warn(
        { userId },
        "Report generation failed: no GitHub installations found",
      );
      return { success: false, error: "No GitHub installations found" };
    }

    // 3. Collect all repo IDs from user's installations
    const repoIds: Id<"repos">[] = [];
    for (const installation of installations) {
      if (installation.repositories) {
        for (const fullName of installation.repositories) {
          const repo = await ctx.runQuery(api.repos.getByFullName, {
            fullName,
          });
          if (repo) {
            repoIds.push(repo._id);
          }
        }
      }
    }

    if (repoIds.length === 0) {
      logger.warn(
        { userId, installationCount: installations.length },
        "Report generation failed: no tracked repositories found",
      );
      return { success: false, error: "No tracked repositories found" };
    }

    // 4. Get events from user's repos (any actor - team view)
    const events = await ctx.runQuery(internal.events.listByReposInWindow, {
      repoIds,
      startDate,
      endDate,
      limit: 2000,
    });

    // Filter to commits only - other event types (PRs, comments) are noise
    // that inflate prompt size and cause truncation. User-requested change.
    const commitEvents = events.filter((e) => e.type === "commit");

    // Extract unique repo names from actual events (not all installations)
    const uniqueRepoIds = [...new Set(commitEvents.map((e) => e.repoId))];
    const repoNames: string[] = [];
    for (const repoId of uniqueRepoIds) {
      const repo = await ctx.runQuery(api.repos.getById, { id: repoId });
      if (repo?.fullName) repoNames.push(repo.fullName);
    }

    if (commitEvents.length === 0) {
      logger.info(
        { userId, kind, startDate, endDate, totalEvents: events.length },
        "No commit events found, skipping report generation",
      );
      return { success: false, error: "No commits in window" };
    }

    // 5. Check for existing report (upsert behavior - replace old with new)
    const existing = await ctx.runQuery(internal.reports.getReportForWindow, {
      userId,
      startDate,
      endDate,
      scheduleType: kind,
    });

    if (existing) {
      await ctx.runMutation(internal.reports.deleteById, { id: existing._id });
      logger.info(
        { existingId: existing._id },
        "Replacing existing report for window",
      );
    }

    logger.info(
      {
        userId,
        kind,
        totalEvents: events.length,
        commitEvents: commitEvents.length,
      },
      "Generating report (commits only)",
    );

    // 6. Build prompts and call LLM with tracing
    const systemPrompt = buildSystemPrompt(kind);
    const userPrompt = buildUserPrompt(
      user.githubUsername,
      commitEvents,
      kind,
      startDate,
      endDate,
      timezone,
    );

    // Create span for LLM call
    const llmSpan = trace?.span({
      name: "llm-call",
      input: { eventCount: commitEvents.length },
    });
    const llmGeneration = llmSpan?.generation({
      name: `generate-${kind}-report`,
      model: "google/gemini-3-pro-preview",
      input: {
        system: systemPrompt.slice(0, 500),
        user: userPrompt.slice(0, 1000),
      },
      metadata: {
        commitCount: commitEvents.length,
        username: user.githubUsername,
      },
    });

    const llmStartTime = Date.now();
    const llmResult = await callOpenRouter(systemPrompt, userPrompt);
    const llmLatencyMs = Date.now() - llmStartTime;

    // End LLM generation with results
    const promptTokens = Math.ceil(
      (systemPrompt.length + userPrompt.length) / 4,
    );
    const completionTokens = Math.ceil(llmResult.content.length / 4);
    const costUsd = calculateCost(
      llmResult.model,
      promptTokens,
      completionTokens,
    );

    llmGeneration?.end({
      output: llmResult.content.slice(0, 2000),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      metadata: { latencyMs: llmLatencyMs, costUsd, success: true },
    });
    llmSpan?.end();

    const { sections, parseError } = parseReportSections(
      llmResult.content,
      kind,
    );
    if (parseError) {
      logger.warn(
        { userId, kind, error: parseError },
        "Failed to parse report JSON, continuing with empty sections",
      );
    }

    const markdown = sectionsToMarkdown(sections);

    // 7. Extract citations and compute diagnostics
    const citationsFromMarkdown = extractCitations(markdown);
    const citations =
      citationsFromMarkdown.length > 0
        ? citationsFromMarkdown
        : extractCitations(llmResult.content);
    const commitsWithUrls = commitEvents.filter((e) => e.sourceUrl);
    const citationRate =
      commitsWithUrls.length > 0
        ? ((citations.length / commitsWithUrls.length) * 100).toFixed(1) + "%"
        : "N/A";

    // 8. Save report with diagnostics
    const reportId = await ctx.runMutation(internal.reports.create, {
      userId,
      title:
        kind === "daily"
          ? `Daily Standup - ${formatReportDate(endDate, timezone)}`
          : `Weekly Retro - Week of ${formatReportDate(startDate, timezone)}`,
      description: `Auto-generated ${kind} report for ${user.githubUsername}`,
      startDate,
      endDate,
      ghLogins: [user.githubUsername],
      markdown,
      html: markdownToHtml(markdown),
      sections,
      citations,
      promptVersion: "v4-commits-only",
      provider: "google",
      model: llmResult.model,
      generatedAt: Date.now(),
      isAutoGenerated: true,
      scheduleType: kind,
      repos: repoNames,
      coverageScore: citations.length > 0 ? 1.0 : 0,
      // Diagnostic fields for observability
      eventCount: commitEvents.length, // Commit count passed to LLM
      citationCount: citations.length,
      expectedCitations: commitsWithUrls.length,
    });

    const totalLatencyMs = Date.now() - startTime;

    logger.info(
      {
        userId,
        kind,
        reportId,
        commitCount: commitEvents.length,
        commitsWithUrls: commitsWithUrls.length,
        citationsExtracted: citations.length,
        citationRate,
        latencyMs: totalLatencyMs,
        costUsd,
      },
      "Report generated with diagnostics",
    );

    // Update trace with success
    trace?.update({
      output: {
        reportId,
        citationCount: citations.length,
        commitCount: commitEvents.length,
      },
      metadata: { success: true, latencyMs: totalLatencyMs, costUsd },
    });
    await flushLangfuse();

    return { success: true, reportId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      { userId, kind, error: errorMessage },
      "Report generation failed",
    );

    // Update trace with error
    trace?.update({
      output: { error: errorMessage },
      metadata: {
        success: false,
        errorType: error instanceof Error ? error.name : "Unknown",
      },
    });
    await flushLangfuse();

    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// LLM Calling - OpenRouter for unified multi-model access
// ============================================================================

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
): Promise<LLMResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const model = "google/gemini-3-pro-preview";

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://gitpulse.app",
        "X-Title": "GitPulse Reports",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 1.0, // Gemini 3 recommended default
        max_tokens: 4000,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const text = choice?.message?.content;
  const finishReason = choice?.finish_reason as string | undefined;

  if (!text) {
    throw new Error("OpenRouter returned empty content");
  }

  // Detect truncation (OpenRouter uses lowercase "stop" / "length")
  if (finishReason && finishReason !== "stop") {
    logger.warn(
      { finishReason, textLength: text.length },
      "Output may be incomplete",
    );
    if (finishReason === "length") {
      throw new Error(
        `Output truncated (${text.length} chars) - reduce input size`,
      );
    }
  }

  return { content: text.trim(), model };
}

// ============================================================================
// Prompt Building - Separated System/User for Better LLM Compliance
// ============================================================================

function buildSystemPrompt(kind: "daily" | "weekly"): string {
  const role =
    kind === "daily"
      ? "You are a senior engineer writing a concise daily standup for your team lead."
      : "You are a tech lead writing a weekly retrospective for stakeholders.";

  return `${role}

CRITICAL RULES:
1. Only reference events from the provided list - never invent activity
2. Every factual claim MUST cite a GitHub URL using markdown links inside bullets
3. If a section has no relevant events, use a single bullet: "No activity recorded"
4. Use specific details: PR numbers, commit messages, file counts, line changes
5. Write in confident, technical prose - be specific, not vague

COVERAGE REQUIREMENT:
- EVERY commit listed MUST be mentioned somewhere in the report
- For minor commits, group them in an "Also completed:" or "Other changes:" bullet
- Every commit URL provided MUST appear as a citation in your bullets
- Do not skip any commits - the user wants a complete record of their work

OUTPUT FORMAT:
- Return ONLY valid JSON (no markdown, no code fences, no extra keys)
- Schema: { "sections": [{ "title": string, "bullets": string[], "citations": string[] }] }
- Bullets must include inline markdown citations: "Fixed auth bug ([PR #42](url))"
- citations must list the GitHub URLs referenced in that section's bullets
- Use the exact section titles provided`;
}

function buildUserPrompt(
  username: string,
  events: Doc<"events">[],
  kind: "daily" | "weekly",
  startDate: number,
  endDate: number,
  timezone: string,
): string {
  const dateRange =
    kind === "daily"
      ? formatReportDate(endDate, timezone)
      : formatDateRange(startDate, endDate, timezone);

  const sections =
    kind === "daily"
      ? "## Work Completed\n## Key Decisions & Context\n## Momentum & Next Steps"
      : "## Accomplishments\n## Technical Insights\n## Challenges & Growth\n## Momentum & Direction";

  const eventLines = events.map(formatEvent);

  return `Generate a ${kind} report for **${username}** covering **${dateRange}**.

EVENTS (${events.length} total):
${eventLines.join("\n")}

SECTIONS TO WRITE (exact titles):
${sections.replaceAll("## ", "- ")}`;
}

// ============================================================================
// Event Formatting - THE KEY FIX: Expose Rich Metadata to LLM
// ============================================================================

function formatEvent(event: Doc<"events">): string {
  const meta = event.metadata as Record<string, unknown> | undefined;
  const url = event.sourceUrl || "";
  const metrics = event.metrics as
    | { additions?: number; deletions?: number; filesChanged?: number }
    | undefined;

  // Build metrics string if available
  const metricsStr =
    metrics?.additions !== undefined
      ? ` (+${metrics.additions}/-${metrics.deletions || 0}, ${metrics.filesChanged || 0} files)`
      : "";

  switch (event.type) {
    case "pr_opened":
    case "pr_merged":
    case "pr_closed": {
      const prNum =
        (meta?.prNumber as number) || (meta?.number as number) || "?";
      const title = (meta?.title as string) || event.canonicalText || "";
      const action = event.type.replace("pr_", "");
      return `- **PR #${prNum}** (${action}): ${title}${metricsStr} [${url}]`;
    }

    case "commit": {
      const message = (meta?.message as string) || event.canonicalText || "";
      const sha = (meta?.sha as string)?.slice(0, 7) || "";
      const shaStr = sha ? ` (${sha})` : "";
      return `- **Commit**${shaStr}: ${message}${metricsStr} [${url}]`;
    }

    case "pr_review": {
      const prNum = (meta?.prNumber as number) || "?";
      const state = (meta?.state as string) || "reviewed";
      const body = (meta?.body as string)?.slice(0, 100) || "";
      const bodyStr = body ? ` - "${body}"` : "";
      return `- **Review PR #${prNum}**: ${state}${bodyStr} [${url}]`;
    }

    case "issue_opened":
    case "issue_closed": {
      const issueNum =
        (meta?.issueNumber as number) || (meta?.number as number) || "?";
      const title = (meta?.title as string) || event.canonicalText || "";
      const action = event.type.replace("issue_", "");
      return `- **Issue #${issueNum}** (${action}): ${title} [${url}]`;
    }

    case "issue_comment":
    case "pr_comment": {
      const num =
        (meta?.issueNumber as number) || (meta?.prNumber as number) || "?";
      const body =
        (meta?.body as string)?.slice(0, 80) || event.canonicalText || "";
      const prefix = event.type === "pr_comment" ? "PR" : "Issue";
      return `- **Comment on ${prefix} #${num}**: "${body}" [${url}]`;
    }

    case "release": {
      const tag = (meta?.tagName as string) || (meta?.tag as string) || "?";
      const name = (meta?.name as string) || "";
      return `- **Release ${tag}**: ${name || "New release"} [${url}]`;
    }

    default:
      return `- [${event.type}] ${event.canonicalText || ""} [${url}]`;
  }
}

// ============================================================================
// Helpers
// ============================================================================

type ReportSection = {
  title: string;
  bullets: string[];
  citations: string[];
};

function parseReportSections(
  rawContent: string,
  kind: "daily" | "weekly",
): { sections: ReportSection[]; parseError?: string } {
  const jsonText = stripJsonFence(rawContent);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { sections: [], parseError: message };
  }

  const schema =
    kind === "daily"
      ? DailyReportSchema.pick({ sections: true })
      : WeeklyReportSchema.pick({ sections: true });

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { sections: [], parseError: result.error.message };
  }

  const sections = result.data.sections.map((section) => ({
    title: section.title,
    bullets: Array.from(section.bullets),
    citations: Array.from(section.citations),
  }));

  return { sections };
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function sectionsToMarkdown(sections: ReportSection[]): string {
  if (sections.length === 0) {
    return "";
  }

  return sections
    .map((section) => {
      const bullets = section.bullets
        .map((bullet) => `- ${bullet.trim()}`)
        .join("\n");
      return `## ${section.title}\n${bullets}`;
    })
    .join("\n\n");
}

function extractCitations(markdown: string): string[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const urls: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const url = match[2];
    if (url?.includes("github.com")) {
      urls.push(url);
    }
  }

  return [...new Set(urls)];
}
