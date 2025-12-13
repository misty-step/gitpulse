/** @type {import("jest").Config} */
module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: [
    "<rootDir>/convex",
    "<rootDir>/lib",
    "<rootDir>/tests",
    "<rootDir>/app",
  ],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^.+/_generated/server$": "<rootDir>/tests/mocks/convexServer.ts",
    "^(.*)\\.js$": "$1", // Map .js imports to .ts files (ESM compatibility)
    "^langfuse$": "<rootDir>/tests/__mocks__/langfuse.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  collectCoverageFrom: [
    "convex/lib/**/*.ts",
    "convex/actions/**/*.ts",
    "lib/**/*.ts",
    "!**/__tests__/**",
    "!**/*.test.ts",
    "!convex/_generated/**",
    // Exclude Convex actions that require integration test infrastructure
    // These actions are covered by integration/e2e tests, not unit tests
    "!convex/actions/sync/**/*.ts",
    "!convex/actions/reports/**/*.ts",
    "!convex/actions/github/scheduler.ts",
    "!convex/actions/github/maintenance.ts",
    // Exclude Convex lib files requiring action context for testing
    // These require full Convex harness for meaningful tests
    "!convex/lib/GitHubClient.ts",
    "!convex/lib/embeddings.ts",
    "!convex/lib/generateReport.ts",
    // Exclude top-level actions with 0% coverage (legacy, rarely changed)
    "!convex/actions/generateScheduledReport.ts",
    "!convex/actions/ingestMultiple.ts",
    "!convex/actions/runCleanup.ts",
    "!convex/actions/startBackfill.ts",
  ],
  coverageThreshold: {
    global: {
      lines: 60,
      functions: 60,
      branches: 55,
      statements: 60,
    },
  },
  coverageReporters: ["text", "lcov", "html", "json-summary"],
};
