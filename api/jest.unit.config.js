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
  // Ratchet (phase 01.3, D-09; raised in phases 01.4, 01.5, 01.6, 01.7 and 01.9): floor of values measured on 2026-09-26. Raise these when
  // coverage improves; never lower them. Regenerate with node scripts/coverage-by-directory.js api.
  coverageThreshold: {
    global: { statements: 70, branches: 66, functions: 50, lines: 66 },
    './src/auth/': { statements: 87, branches: 78, functions: 82, lines: 89 },
    './src/common/': { statements: 88, branches: 90, functions: 60, lines: 88 },
    './src/config/': { statements: 96, branches: 94, functions: 96, lines: 96 },
    './src/database/': { statements: 90, branches: 100, functions: 62, lines: 89 },
    './src/debug/': { statements: 74, branches: 52, functions: 42, lines: 76 },
    './src/reports/': { statements: 64, branches: 52, functions: 35, lines: 62 },
    './src/storage/': { statements: 99, branches: 97, functions: 100, lines: 100 },
    './src/surveys/': { statements: 81, branches: 67, functions: 79, lines: 82 },
    './src/users/': { statements: 92, branches: 91, functions: 58, lines: 92 },
  },
};
