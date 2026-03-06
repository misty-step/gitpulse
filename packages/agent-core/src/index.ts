export { runGitPulseAgent } from "./agent";
export type {
  LlmNarrativeResult,
  MaybeGenerateAnswerInput,
  NarrativeGenerator,
  RunGitPulseAgentInput,
} from "./agent";
export { fetchActivityWindow } from "./github/activity";
export { computeMetrics, buildBlocks, buildCitations, describeEvent } from "./metrics";
