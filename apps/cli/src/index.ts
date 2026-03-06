#!/usr/bin/env bun
import { runGitPulseAgent } from "@gitpulse/agent-core";
import { TimeWindowSchema, normalizeScope, type ActivityMetrics } from "@gitpulse/schemas";

type ParsedArgs = {
  command: string;
  question: string;
  from: string;
  to: string;
  repos: string[];
  orgs: string[];
  contributors: string[];
  json: boolean;
  modelId?: string;
};

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.command === "help") {
    printUsage();
    return;
  }

  const window = TimeWindowSchema.parse({
    from: parsed.from,
    to: parsed.to,
  });

  const answer = await runGitPulseAgent({
    question: parsed.question,
    window,
    scope: normalizeScope({
      repos: parsed.repos,
      orgs: parsed.orgs,
      contributors: parsed.contributors,
    }),
    modelId: parsed.modelId,
    githubToken: process.env.GITHUB_TOKEN,
  });

  if (parsed.json) {
    process.stdout.write(`${JSON.stringify(answer, null, 2)}\n`);
    return;
  }

  printAnswer(answer.answer);
  printMetrics(answer.metrics);
  printCitations(answer.citations);
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help" || argv[0] === "help") {
    return {
      command: "help",
      question: "",
      from: defaultFrom(),
      to: nowIso(),
      repos: [],
      orgs: [],
      contributors: [],
      json: false,
    };
  }

  const command = argv[0] ?? "ask";

  if (command !== "ask") {
    throw new Error(`Unknown command: ${command}`);
  }

  const questionParts: string[] = [];
  const flags: Record<string, string | boolean> = {};

  let index = 1;
  while (index < argv.length) {
    const value = argv[index];

    if (!value) {
      break;
    }

    if (value.startsWith("--")) {
      const [rawKey = "", inlineValue] = value.split("=", 2);
      const key = rawKey.slice(2);

      if (inlineValue !== undefined) {
        flags[key] = inlineValue;
        index += 1;
        continue;
      }

      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        flags[key] = true;
        index += 1;
        continue;
      }

      flags[key] = next;
      index += 2;
      continue;
    }

    questionParts.push(value);
    index += 1;
  }

  const question = questionParts.join(" ").trim();
  if (!question) {
    throw new Error("A question is required. Example: gitpulse ask \"what happened last week\"");
  }

  return {
    command,
    question,
    from: asIso(flags.from) ?? defaultFrom(),
    to: asIso(flags.to) ?? nowIso(),
    repos: csv(flags.repos),
    orgs: csv(flags.orgs),
    contributors: csv(flags.contributors),
    json: Boolean(flags.json),
    modelId: asString(flags.model),
  };
}

function printUsage(): void {
  const usage = [
    "gitpulse ask \"question\" [flags]",
    "",
    "Flags:",
    "  --from <iso-date>            Window start. Default: now - 7 days",
    "  --to <iso-date>              Window end. Default: now",
    "  --repos <owner/repo,...>     Explicit repos",
    "  --orgs <org,...>             Expand repos from orgs",
    "  --contributors <user,...>    Restrict actors",
    "  --model <openrouter-model>   Override model (default from GITPULSE_MODEL_PRIMARY)",
    "  --json                       Emit full JSON payload",
    "",
    "Examples:",
    "  gitpulse ask \"what did we ship\" --from 2026-02-01T00:00:00Z --to 2026-03-01T00:00:00Z --orgs misty-step",
    "  gitpulse ask \"compare this week to last week\" --repos misty-step/gitpulse,misty-step/overmind --contributors phaedrus",
  ];

  process.stdout.write(`${usage.join("\n")}\n`);
}

function printAnswer(answer: string): void {
  process.stdout.write(`\n# Answer\n\n${answer}\n`);
}

function printMetrics(metrics: ActivityMetrics): void {
  process.stdout.write("\n# Metrics\n\n");
  process.stdout.write(`totalEvents=${metrics.totalEvents}\n`);
  process.stdout.write(`commits=${metrics.commitCount}\n`);
  process.stdout.write(`prsOpened=${metrics.pullRequestOpenedCount}\n`);
  process.stdout.write(`prsMerged=${metrics.pullRequestMergedCount}\n`);
  process.stdout.write(`reviews=${metrics.reviewCount}\n`);

  process.stdout.write("\nTop contributors:\n");
  for (const row of metrics.contributors.slice(0, 5)) {
    process.stdout.write(`- ${row.login}: ${row.eventCount}\n`);
  }

  process.stdout.write("\nTop repos:\n");
  for (const row of metrics.repos.slice(0, 5)) {
    process.stdout.write(`- ${row.repo}: ${row.totalEvents}\n`);
  }
}

function printCitations(citations: Array<{ label: string; url: string }>): void {
  process.stdout.write("\n# Citations\n\n");
  for (const citation of citations.slice(0, 15)) {
    process.stdout.write(`- ${citation.label}: ${citation.url}\n`);
  }
}

function defaultFrom(): string {
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(now.getUTCDate() - 7);
  return sevenDaysAgo.toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

function csv(value: string | boolean | undefined): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asIso(value: string | boolean | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return new Date(parsed).toISOString();
}

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

if (import.meta.main) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
