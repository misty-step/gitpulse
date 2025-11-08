/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_embeddings_ensureBatch from "../actions/embeddings/ensureBatch.js";
import type * as actions_generateEmbeddings from "../actions/generateEmbeddings.js";
import type * as actions_generateScheduledReport from "../actions/generateScheduledReport.js";
import type * as actions_generateTestReports from "../actions/generateTestReports.js";
import type * as actions_github_processWebhook from "../actions/github/processWebhook.js";
import type * as actions_github_scheduler from "../actions/github/scheduler.js";
import type * as actions_github_startBackfill from "../actions/github/startBackfill.js";
import type * as actions_github_maintenance from "../actions/github/maintenance.js";
import type * as actions_ingestMultiple from "../actions/ingestMultiple.js";
import type * as actions_ingestRepo from "../actions/ingestRepo.js";
import type * as actions_listRepos from "../actions/listRepos.js";
import type * as actions_runDailyReports from "../actions/runDailyReports.js";
import type * as actions_runWeeklyReports from "../actions/runWeeklyReports.js";
import type * as actions_syncUserActivity from "../actions/syncUserActivity.js";
import type * as actions_vectorSearch from "../actions/vectorSearch.js";
import type * as crons from "../crons.js";
import type * as embeddings from "../embeddings.js";
import type * as reportJobHistory from "../reportJobHistory.js";
import type * as embeddingQueue from "../embeddingQueue.js";
import type * as events from "../events.js";
import type * as ingestionJobs from "../ingestionJobs.js";
import type * as installations from "../installations.js";
import type * as kpis from "../kpis.js";
import type * as lib_GitHubClient from "../lib/GitHubClient.js";
import type * as lib_LLMClient from "../lib/LLMClient.js";
import type * as lib_authHealth from "../lib/authHealth.js";
import type * as lib_embeddings from "../lib/embeddings.js";
import type * as lib_github from "../lib/github.js";
import type * as lib_markdown from "../lib/markdown.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_reportContext from "../lib/reportContext.js";
import type * as lib_reportGenerator from "../lib/reportGenerator.js";
import type * as lib_types from "../lib/types.js";
import type * as reports from "../reports.js";
import type * as repos from "../repos.js";
import type * as users from "../users.js";
import type * as webhookEvents from "../webhookEvents.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "actions/embeddings/ensureBatch": typeof actions_embeddings_ensureBatch;
  "actions/generateEmbeddings": typeof actions_generateEmbeddings;
  "actions/generateScheduledReport": typeof actions_generateScheduledReport;
  "actions/generateTestReports": typeof actions_generateTestReports;
  "actions/github/processWebhook": typeof actions_github_processWebhook;
  "actions/github/scheduler": typeof actions_github_scheduler;
  "actions/github/startBackfill": typeof actions_github_startBackfill;
  "actions/github/maintenance": typeof actions_github_maintenance;
  "actions/ingestMultiple": typeof actions_ingestMultiple;
  "actions/ingestRepo": typeof actions_ingestRepo;
  "actions/listRepos": typeof actions_listRepos;
  "actions/runDailyReports": typeof actions_runDailyReports;
  "actions/runWeeklyReports": typeof actions_runWeeklyReports;
  "actions/syncUserActivity": typeof actions_syncUserActivity;
  "actions/vectorSearch": typeof actions_vectorSearch;
  crons: typeof crons;
  embeddings: typeof embeddings;
  reportJobHistory: typeof reportJobHistory;
  embeddingQueue: typeof embeddingQueue;
  events: typeof events;
  ingestionJobs: typeof ingestionJobs;
  installations: typeof installations;
  kpis: typeof kpis;
  "lib/GitHubClient": typeof lib_GitHubClient;
  "lib/LLMClient": typeof lib_LLMClient;
  "lib/authHealth": typeof lib_authHealth;
  "lib/embeddings": typeof lib_embeddings;
  "lib/github": typeof lib_github;
  "lib/markdown": typeof lib_markdown;
  "lib/prompts": typeof lib_prompts;
  "lib/reportContext": typeof lib_reportContext;
  "lib/reportGenerator": typeof lib_reportGenerator;
  "lib/types": typeof lib_types;
  reports: typeof reports;
  repos: typeof repos;
  users: typeof users;
  webhookEvents: typeof webhookEvents;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
