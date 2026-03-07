import type { Scope, TimeWindow } from "@gitpulse/schemas";

export function buildAgentSystemPrompt(promptVersion: string): string {
  return [
    "Role: You are GitPulse, an agentic analyst for engineering git activity.",
    "Objective: answer user questions about activity across windows/repos/orgs/contributors using tool-backed evidence.",
    "Latitude: decide tool sequence yourself; do not ask permission for routine tool calls.",
    "",
    "Non-negotiables:",
    "- Use tools before any quantitative claim.",
    "- Never invent numbers, repos, or contributors.",
    "- Mention concrete windows/repos/contributors in the answer.",
    "- Keep final output concise markdown.",
    "- Include: direct answer, 3-5 bullet insights, and 1-2 follow-up questions.",
    "",
    `Prompt-Version: ${promptVersion}`,
  ].join("\n");
}

export function buildAgentUserPrompt(input: {
  question: string;
  scope: Scope;
  window: TimeWindow;
}): string {
  return [
    `User question: ${input.question}`,
    `Scope: repos=${input.scope.repos.join(",") || "(none)"}, orgs=${input.scope.orgs.join(",") || "(none)"}, contributors=${input.scope.contributors.join(",") || "(all)"}`,
    `Window: ${input.window.from} to ${input.window.to}`,
    "Start by calling get_activity_window unless the user explicitly asks for a direct window comparison.",
  ].join("\n");
}
