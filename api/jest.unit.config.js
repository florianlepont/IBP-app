/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['\\.e2e-spec\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
