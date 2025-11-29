/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions__nodeUtils from "../actions/_nodeUtils.js";
import type * as actions_embeddings_ensureBatch from "../actions/embeddings/ensureBatch.js";
import type * as actions_generateEmbeddings from "../actions/generateEmbeddings.js";
import type * as actions_generateScheduledReport from "../actions/generateScheduledReport.js";
import type * as actions_generateTestReports from "../actions/generateTestReports.js";
import type * as actions_github_maintenance from "../actions/github/maintenance.js";
import type * as actions_github_processWebhook from "../actions/github/processWebhook.js";
import type * as actions_github_scheduler from "../actions/github/scheduler.js";
import type * as actions_github_startBackfill from "../actions/github/startBackfill.js";
import type * as actions_ingestMultiple from "../actions/ingestMultiple.js";
import type * as actions_ingestRepo from "../actions/ingestRepo.js";
import type * as actions_listRepos from "../actions/listRepos.js";
import type * as actions_reports_regenerate from "../actions/reports/regenerate.js";
import type * as actions_reports_runRegeneration from "../actions/reports/runRegeneration.js";
import type * as actions_runCleanup from "../actions/runCleanup.js";
import type * as actions_runDailyReports from "../actions/runDailyReports.js";
import type * as actions_runWeeklyReports from "../actions/runWeeklyReports.js";
import type * as actions_startBackfill from "../actions/startBackfill.js";
import type * as actions_syncUserActivity from "../actions/syncUserActivity.js";
import type * as actions_vectorSearch from "../actions/vectorSearch.js";
import type * as crons from "../crons.js";
import type * as embeddingQueue from "../embeddingQueue.js";
import type * as embeddings from "../embeddings.js";
import type * as events from "../events.js";
import type * as healthCheck from "../healthCheck.js";
import type * as http from "../http.js";
import type * as ingestionJobs from "../ingestionJobs.js";
import type * as installations from "../installations.js";
import type * as integrations from "../integrations.js";
import type * as kpis from "../kpis.js";
import type * as lib_GitHubClient from "../lib/GitHubClient.js";
import type * as lib_LLMClient from "../lib/LLMClient.js";
import type * as lib_authHealth from "../lib/authHealth.js";
import type * as lib_canonicalFactService from "../lib/canonicalFactService.js";
import type * as lib_canonicalizeEvent from "../lib/canonicalizeEvent.js";
import type * as lib_contentHash from "../lib/contentHash.js";
import type * as lib_coverage from "../lib/coverage.js";
import type * as lib_embeddings from "../lib/embeddings.js";
import type * as lib_github from "../lib/github.js";
import type * as lib_githubApp from "../lib/githubApp.js";
import type * as lib_githubTypes from "../lib/githubTypes.js";
import type * as lib_llmOrchestrator from "../lib/llmOrchestrator.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_markdown from "../lib/markdown.js";
import type * as lib_metrics from "../lib/metrics.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_reportContext from "../lib/reportContext.js";
import type * as lib_reportGenerator from "../lib/reportGenerator.js";
import type * as lib_reportOrchestrator from "../lib/reportOrchestrator.js";
import type * as lib_reportSchemas from "../lib/reportSchemas.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_url from "../lib/url.js";
import type * as reportJobHistory from "../reportJobHistory.js";
import type * as reportRegenerations from "../reportRegenerations.js";
import type * as reports from "../reports.js";
import type * as repos from "../repos.js";
import type * as users from "../users.js";
import type * as webhookEvents from "../webhookEvents.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/_nodeUtils": typeof actions__nodeUtils;
  "actions/embeddings/ensureBatch": typeof actions_embeddings_ensureBatch;
  "actions/generateEmbeddings": typeof actions_generateEmbeddings;
  "actions/generateScheduledReport": typeof actions_generateScheduledReport;
  "actions/generateTestReports": typeof actions_generateTestReports;
  "actions/github/maintenance": typeof actions_github_maintenance;
  "actions/github/processWebhook": typeof actions_github_processWebhook;
  "actions/github/scheduler": typeof actions_github_scheduler;
  "actions/github/startBackfill": typeof actions_github_startBackfill;
  "actions/ingestMultiple": typeof actions_ingestMultiple;
  "actions/ingestRepo": typeof actions_ingestRepo;
  "actions/listRepos": typeof actions_listRepos;
  "actions/reports/regenerate": typeof actions_reports_regenerate;
  "actions/reports/runRegeneration": typeof actions_reports_runRegeneration;
  "actions/runCleanup": typeof actions_runCleanup;
  "actions/runDailyReports": typeof actions_runDailyReports;
  "actions/runWeeklyReports": typeof actions_runWeeklyReports;
  "actions/startBackfill": typeof actions_startBackfill;
  "actions/syncUserActivity": typeof actions_syncUserActivity;
  "actions/vectorSearch": typeof actions_vectorSearch;
  crons: typeof crons;
  embeddingQueue: typeof embeddingQueue;
  embeddings: typeof embeddings;
  events: typeof events;
  healthCheck: typeof healthCheck;
  http: typeof http;
  ingestionJobs: typeof ingestionJobs;
  installations: typeof installations;
  integrations: typeof integrations;
  kpis: typeof kpis;
  "lib/GitHubClient": typeof lib_GitHubClient;
  "lib/LLMClient": typeof lib_LLMClient;
  "lib/authHealth": typeof lib_authHealth;
  "lib/canonicalFactService": typeof lib_canonicalFactService;
  "lib/canonicalizeEvent": typeof lib_canonicalizeEvent;
  "lib/contentHash": typeof lib_contentHash;
  "lib/coverage": typeof lib_coverage;
  "lib/embeddings": typeof lib_embeddings;
  "lib/github": typeof lib_github;
  "lib/githubApp": typeof lib_githubApp;
  "lib/githubTypes": typeof lib_githubTypes;
  "lib/llmOrchestrator": typeof lib_llmOrchestrator;
  "lib/logger": typeof lib_logger;
  "lib/markdown": typeof lib_markdown;
  "lib/metrics": typeof lib_metrics;
  "lib/prompts": typeof lib_prompts;
  "lib/reportContext": typeof lib_reportContext;
  "lib/reportGenerator": typeof lib_reportGenerator;
  "lib/reportOrchestrator": typeof lib_reportOrchestrator;
  "lib/reportSchemas": typeof lib_reportSchemas;
  "lib/types": typeof lib_types;
  "lib/url": typeof lib_url;
  reportJobHistory: typeof reportJobHistory;
  reportRegenerations: typeof reportRegenerations;
  reports: typeof reports;
  repos: typeof repos;
  users: typeof users;
  webhookEvents: typeof webhookEvents;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
