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

// ============================================================================
// Types
// ============================================================================

export interface GenerateReportParams {
  userId: string; // Clerk user ID
  startDate: number;
  endDate: number;
  kind: "daily" | "weekly";
}

export interface GenerateReportResult {
  success: boolean;
  reportId?: Id<"reports">;
  error?: string;
}

interface LLMResult {
  markdown: string;
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
  params: GenerateReportParams
): Promise<GenerateReportResult> {
  const { userId, startDate, endDate, kind } = params;

  try {
    // 1. Get user
    const user = await ctx.runQuery(api.users.getByClerkId, { clerkId: userId });
    if (!user?.githubUsername) {
      logger.warn({ userId }, "Report generation failed: user not found or missing GitHub username");
      return { success: false, error: "User not found or missing GitHub username" };
    }

    // 2. Get user's tracked repos via installations
    const installations = await ctx.runQuery(api.installations.listByClerkUser, {
      clerkUserId: userId,
    });

    if (installations.length === 0) {
      logger.warn({ userId }, "Report generation failed: no GitHub installations found");
      return { success: false, error: "No GitHub installations found" };
    }

    // 3. Collect all repo IDs from user's installations
    const repoIds: Id<"repos">[] = [];
    for (const installation of installations) {
      if (installation.repositories) {
        for (const fullName of installation.repositories) {
          const repo = await ctx.runQuery(api.repos.getByFullName, { fullName });
          if (repo) {
            repoIds.push(repo._id);
          }
        }
      }
    }

    if (repoIds.length === 0) {
      logger.warn(
        { userId, installationCount: installations.length },
        "Report generation failed: no tracked repositories found"
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

    if (events.length === 0) {
      logger.info(
        { userId, kind, startDate, endDate },
        "No events found, skipping report generation"
      );
      return { success: false, error: "No events in window" };
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
      logger.info({ existingId: existing._id }, "Replacing existing report for window");
    }

    logger.info(
      { userId, kind, eventCount: events.length },
      "Generating report"
    );

    // 6. Build prompts and call LLM
    const systemPrompt = buildSystemPrompt(kind);
    const userPrompt = buildUserPrompt(user.githubUsername, events, kind, startDate, endDate);
    const llmResult = await callGemini(systemPrompt, userPrompt);

    // 7. Extract citations and compute diagnostics
    const citations = extractCitations(llmResult.markdown);
    const eventsWithUrls = events.filter(e => e.sourceUrl);
    const citationRate = eventsWithUrls.length > 0
      ? (citations.length / eventsWithUrls.length * 100).toFixed(1) + "%"
      : "N/A";

    // 8. Save report with diagnostics
    const reportId = await ctx.runMutation(internal.reports.create, {
      userId,
      title: kind === "daily"
        ? `Daily Standup - ${formatDate(endDate)}`
        : `Weekly Retro - Week of ${formatDate(startDate)}`,
      description: `Auto-generated ${kind} report for ${user.githubUsername}`,
      startDate,
      endDate,
      ghLogins: [user.githubUsername],
      markdown: llmResult.markdown,
      html: markdownToHtml(llmResult.markdown),
      citations,
      promptVersion: "v3-rich-metadata",
      provider: "google",
      model: llmResult.model,
      generatedAt: Date.now(),
      isAutoGenerated: true,
      scheduleType: kind,
      coverageScore: citations.length > 0 ? 1.0 : 0,
      // Diagnostic fields for observability
      eventCount: events.length,
      citationCount: citations.length,
      expectedCitations: eventsWithUrls.length,
    });

    logger.info(
      {
        userId,
        kind,
        reportId,
        eventCount: events.length,
        eventsWithUrls: eventsWithUrls.length,
        citationsExtracted: citations.length,
        citationRate,
      },
      "Report generated with diagnostics"
    );

    return { success: true, reportId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ userId, kind, error: errorMessage }, "Report generation failed");
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// LLM Calling
// ============================================================================

async function callGemini(systemPrompt: string, userPrompt: string): Promise<LLMResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY not configured");
  }

  const model = "gemini-2.5-flash-preview-05-20";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1, // Slight variety while maintaining factuality
          maxOutputTokens: 2500,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned empty content");
  }

  return { markdown: text.trim(), model };
}

// ============================================================================
// Prompt Building - Separated System/User for Better LLM Compliance
// ============================================================================

function buildSystemPrompt(kind: "daily" | "weekly"): string {
  const role = kind === "daily"
    ? "You are a senior engineer writing a concise daily standup for your team lead."
    : "You are a tech lead writing a weekly retrospective for stakeholders.";

  return `${role}

CRITICAL RULES:
1. Only reference events from the provided list - never invent activity
2. Every factual claim MUST cite a GitHub URL: [description](url)
3. If a section has no relevant events, write "No activity recorded" - do not fabricate
4. Use specific details: PR numbers, commit messages, file counts, line changes
5. Write in confident, technical prose - be specific, not vague

OUTPUT FORMAT:
- Use markdown with the exact section headings provided
- 2-3 paragraphs per section maximum
- Inline citations immediately after claims: "Fixed the auth bug ([PR #42](url))"
- Group related work together for narrative flow`;
}

function buildUserPrompt(
  username: string,
  events: Doc<"events">[],
  kind: "daily" | "weekly",
  startDate: number,
  endDate: number
): string {
  const dateRange = kind === "daily"
    ? formatDate(endDate)
    : `${formatDate(startDate)} — ${formatDate(endDate)}`;

  const sections = kind === "daily"
    ? "## Work Completed\n## Key Decisions & Context\n## Momentum & Next Steps"
    : "## Accomplishments\n## Technical Insights\n## Challenges & Growth\n## Momentum & Direction";

  const eventLines = events.map(formatEvent);

  return `Generate a ${kind} report for **${username}** covering **${dateRange}**.

EVENTS (${events.length} total):
${eventLines.join("\n")}

SECTIONS TO WRITE:
${sections}`;
}

// ============================================================================
// Event Formatting - THE KEY FIX: Expose Rich Metadata to LLM
// ============================================================================

function formatEvent(event: Doc<"events">): string {
  const meta = event.metadata as Record<string, unknown> | undefined;
  const url = event.sourceUrl || "";
  const metrics = event.metrics as { additions?: number; deletions?: number; filesChanged?: number } | undefined;

  // Build metrics string if available
  const metricsStr = metrics?.additions !== undefined
    ? ` (+${metrics.additions}/-${metrics.deletions || 0}, ${metrics.filesChanged || 0} files)`
    : "";

  switch (event.type) {
    case "pr_opened":
    case "pr_merged":
    case "pr_closed": {
      const prNum = (meta?.prNumber as number) || (meta?.number as number) || "?";
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
      const issueNum = (meta?.issueNumber as number) || (meta?.number as number) || "?";
      const title = (meta?.title as string) || event.canonicalText || "";
      const action = event.type.replace("issue_", "");
      return `- **Issue #${issueNum}** (${action}): ${title} [${url}]`;
    }

    case "issue_comment":
    case "pr_comment": {
      const num = (meta?.issueNumber as number) || (meta?.prNumber as number) || "?";
      const body = (meta?.body as string)?.slice(0, 80) || event.canonicalText || "";
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

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
