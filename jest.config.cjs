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
  ],
  coverageThresholds: {
    global: {
      lines: 60,
      functions: 60,
      branches: 55,
      statements: 60,
    },
  },
  coverageReporters: ["text", "lcov", "html"],
};
