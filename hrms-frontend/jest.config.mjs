import nextJest from "next/jest.js";

// Prefer mock shell in unit/functional/regression unless a test sets a base.
delete process.env.NEXT_PUBLIC_API_BASE;

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "<rootDir>/test/jest-environment-jsdom-fetch.cjs",
  setupFiles: ["<rootDir>/test/setup.mocks.ts"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  testMatch: ["**/test/**/*.{test,spec}.{ts,tsx}"],
  testPathIgnorePatterns: ["/node_modules/", "/test/e2e/"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  testTimeout: 30_000,
};

export default createJestConfig(customJestConfig);
