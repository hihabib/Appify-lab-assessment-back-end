/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          // Override to allow CommonJS modules in tests without affecting build
          module: "CommonJS",
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "js", "json"],
  // Skip DB integration tests unless TEST_DATABASE_URL is explicitly set
  testPathIgnorePatterns: [
    ...(process.env.TEST_DATABASE_URL ? [] : ["<rootDir>/src/modules/.*/__tests__/"]),
  ],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/server.ts",
  ],
  coverageDirectory: "coverage",
  clearMocks: true,
};
