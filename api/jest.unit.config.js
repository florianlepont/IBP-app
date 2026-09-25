/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/setup-env.js'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.d.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/unit',
  coverageReporters: ['text', 'text-summary', 'json-summary', 'lcov'],
  // Ratchet (phase 01.3, D-09; raised in phases 01.4 and 01.5): floor of values measured on 2026-09-25. Raise these when
  // coverage improves; never lower them. Regenerate with node scripts/coverage-by-directory.js api.
  coverageThreshold: {
    global: { statements: 66, branches: 62, functions: 20, lines: 63 },
    './src/auth/': { statements: 76, branches: 67, functions: 62, lines: 77 },
    './src/common/': { statements: 76, branches: 71, functions: 37, lines: 79 },
    './src/database/': { statements: 88, branches: 100, functions: 57, lines: 85 },
    './src/debug/': { statements: 71, branches: 47, functions: 38, lines: 72 },
    './src/reports/': { statements: 36, branches: 0, functions: 0, lines: 32 },
    './src/storage/': { statements: 99, branches: 94, functions: 100, lines: 100 },
    './src/surveys/': { statements: 48, branches: 36, functions: 39, lines: 48 },
    './src/users/': { statements: 69, branches: 46, functions: 47, lines: 69 },
  },
};
