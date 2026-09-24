/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  testMatch: ["**/*.e2e-spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  testTimeout: 15000,
  globalSetup: "<rootDir>/test/global-setup.js",
  setupFiles: ["<rootDir>/test/setup-env.js", "<rootDir>/test/setup-e2e-env.js"],
  moduleNameMapper: { "^jwks-rsa$": "<rootDir>/test/__mocks__/jwks-rsa.js" },
  collectCoverageFrom: ["<rootDir>/src/**/*.ts", "!<rootDir>/src/**/*.d.ts"],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "text-summary", "json-summary", "lcov"],
}
